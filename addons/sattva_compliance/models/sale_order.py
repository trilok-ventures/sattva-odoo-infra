import re

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError

from .credit_access import check_order_credit_vals

_INCOTERM_FLAG = {
    "fob": "incoterm_fob",
    "cif": "incoterm_cif",
    "dap": "incoterm_dap",
}


def _folder_token(value):
    return re.sub(r"\W+", "_", value or "").strip("_")


class SaleOrder(models.Model):
    _inherit = "sale.order"

    sattva_incoterm = fields.Selection(
        [("fob", "FOB"), ("cif", "CIF"), ("dap", "DAP")],
        string="Sattva Incoterm",
        tracking=True,
        help="DDP is omitted until OpCo writes an Importer-of-Record policy.",
    )
    forwarder_id = fields.Many2one(
        "res.partner",
        string="Approved forwarder",
        domain="[('is_logistics_partner', '=', True), ('supplier_rank', '=', 0)]",
        ondelete="restrict",
        tracking=True,
    )
    purchase_intent_id = fields.Many2one(
        "purchase.order",
        string="Linked PO intent",
        ondelete="set null",
        help="Required on a buyer's first confirmed SO. n8n must not confirm this PO.",
    )
    nextcloud_order_folder_path = fields.Char(
        string="Nextcloud order vault path",
        readonly=True,
        help="Path in Nextcloud for this SO. Files stay in the vault.",
    )
    fcl_count = fields.Integer(
        string="FCL count",
        default=0,
        help="AMBER container count. Confirmed SOs feed volume V on the buyer credit score.",
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            check_order_credit_vals(self.env, vals)
        orders = super().create(vals_list)
        events = []
        for order in orders:
            buyer = _folder_token(order.partner_id.name)
            so_name = _folder_token(order.name) or str(order.id)
            events.append(
                {
                    "event_type": "order_folder_requested",
                    "partner_id": order.partner_id.id,
                    "sale_order_id": order.id,
                    "requested_path": f"/Clients/{buyer}/Orders/{so_name}/",
                }
            )
        if events:
            self.env["sattva.fabric.event"].sudo().create(events)
        return orders

    def write(self, vals):
        check_order_credit_vals(self.env, vals)
        return super().write(vals)

    @api.constrains("fcl_count")
    def _check_fcl_count(self):
        for order in self:
            if order.fcl_count < 0:
                raise ValidationError("FCL count cannot be negative.")

    def action_confirm(self):
        self._sattva_check_sale_gates()
        return super().action_confirm()

    def _sattva_check_sale_gates(self):
        for order in self:
            buyer = order.partner_id.commercial_partner_id
            if buyer.buyer_sfc_status != "active":
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm SO.\n"
                    f"Buyer '{buyer.name}' has SFC status "
                    f"'{buyer.buyer_sfc_status}'. Sale confirm requires SFC Active."
                )
            forwarder = order.forwarder_id
            if (
                not forwarder
                or not forwarder.is_logistics_partner
                or forwarder.supplier_rank > 0
            ):
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm SO.\n"
                    "Select a logistics / 3PL partner (not a supplier_rank vendor)."
                )
            if forwarder.forwarder_status != "approved":
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm SO.\n"
                    f"Forwarder '{forwarder.name}' has status "
                    f"'{forwarder.forwarder_status}'."
                )
            if not order.sattva_incoterm:
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm SO.\n"
                    "Set Incoterm to FOB, CIF, or DAP. DDP is not offered."
                )
            flag = _INCOTERM_FLAG.get(order.sattva_incoterm)
            if not flag or not forwarder[flag]:
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm SO.\n"
                    f"Forwarder '{forwarder.name}' does not support "
                    f"{order.sattva_incoterm.upper()}."
                )
            native = order._sattva_native_incoterm_code()
            if native == "DDP":
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm SO.\n"
                    "Set Incoterm to FOB, CIF, or DAP. DDP is not offered."
                )
            if order._sattva_is_first_confirm() and not order._sattva_first_order_pcp_ok():
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm first SO.\n"
                    "Link a PO intent whose supplier is PCP Approved. "
                    "n8n must not confirm the PO."
                )
            if buyer.credit_risk_tier == "4" and order.sattva_incoterm != "fob":
                raise UserError(
                    "Compliance Gate Blocked: Cannot confirm SO.\n"
                    f"Buyer '{buyer.name}' is credit tier 4. Incoterm must be FOB."
                )

    def _sattva_native_incoterm_code(self):
        self.ensure_one()
        if "incoterm" not in self._fields:
            return ""
        record = self.incoterm
        return (record.code or "").upper() if record else ""

    def _sattva_is_first_confirm(self):
        self.ensure_one()
        commercial = self.partner_id.commercial_partner_id
        return (
            self.search_count(
                [
                    ("partner_id", "child_of", commercial.id),
                    ("state", "in", ("sale", "done")),
                    ("id", "!=", self.id),
                ]
            )
            == 0
        )

    def _sattva_first_order_pcp_ok(self):
        self.ensure_one()
        intent = self.purchase_intent_id
        mill = intent.partner_id if intent else self.env["res.partner"]
        return bool(
            mill
            and mill.supplier_rank > 0
            and not mill.is_logistics_partner
            and mill.supplier_pcp_status == "approved"
        )
