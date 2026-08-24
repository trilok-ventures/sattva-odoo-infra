from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError


INCOTERMS = [
    ("FOB", "FOB"),
    ("CIF", "CIF"),
    ("DAP", "DAP"),
    ("DDP", "DDP"),
]


class SaleOrder(models.Model):
    _inherit = "sale.order"

    sattva_supplier_id = fields.Many2one(
        "res.partner",
        string="Filling supplier",
        domain="[('supplier_rank', '>', 0)]",
        help="Indian mill filling this FCL. PCP status is SoR on the partner.",
    )
    sattva_forwarder_id = fields.Many2one(
        "res.partner",
        string="3PL / forwarder",
        domain="[('is_freight_forwarder', '=', True)]",
    )
    sattva_incoterm = fields.Selection(INCOTERMS, string="Incoterm")
    sattva_first_order = fields.Boolean(
        string="First FCL for buyer",
        compute="_compute_sattva_first_order",
        store=True,
    )
    sattva_compliance_hold = fields.Boolean(
        string="First-order compliance hold",
        default=False,
        copy=False,
    )
    sattva_hold_released = fields.Boolean(
        string="Officer released first-order hold",
        default=False,
        copy=False,
    )
    sattva_hold_reason = fields.Char(string="Hold reason", copy=False)

    @api.depends("partner_id")
    def _compute_sattva_first_order(self):
        for order in self:
            if not order.partner_id:
                order.sattva_first_order = True
                continue
            domain = [
                ("partner_id", "=", order.partner_id.id),
                ("state", "!=", "cancel"),
            ]
            if order.id:
                domain.append(("id", "!=", order.id))
            order.sattva_first_order = not self.search_count(domain)

    @api.model_create_multi
    def create(self, vals_list):
        orders = super().create(vals_list)
        orders._apply_first_order_hold()
        return orders

    def write(self, vals):
        result = super().write(vals)
        watch = {
            "sattva_supplier_id",
            "sattva_forwarder_id",
            "partner_id",
            "sattva_hold_released",
        }
        if watch & set(vals):
            self._apply_first_order_hold()
        return result

    def action_confirm(self):
        for order in self:
            if order.sattva_compliance_hold:
                raise UserError(
                    "Compliance Hold: first-order checks failed "
                    f"({order.sattva_hold_reason or 'supplier / 3PL / SFC'}). "
                    "A compliance officer must release the hold. "
                    "This does not confirm the order and does not bypass the PO PCP gate."
                )
        return super().action_confirm()

    def action_release_first_order_hold(self):
        if not (
            self.env.is_superuser()
            or self.env.user.has_group("sattva_compliance.group_compliance_officer")
        ):
            raise AccessError("Only a compliance officer may release a first-order hold.")
        for order in self:
            order.sudo().write(
                {
                    "sattva_hold_released": True,
                    "sattva_compliance_hold": False,
                    "sattva_hold_reason": False,
                }
            )
        return True

    def _first_order_failures(self):
        self.ensure_one()
        failures = []
        supplier = self.sattva_supplier_id
        if not supplier or supplier.supplier_pcp_status != "approved":
            failures.append("supplier not PCP approved")
        forwarder = self.sattva_forwarder_id
        if (
            not forwarder
            or not forwarder.is_freight_forwarder
            or forwarder.forwarder_status != "approved"
        ):
            failures.append("3PL not approved")
        if self.partner_id.sfc_licence_status != "active":
            failures.append("buyer SFC not ACTIVE")
        return failures

    def _apply_first_order_hold(self):
        for order in self:
            if order.state in ("cancel", "sale", "done"):
                continue
            if order.sattva_hold_released:
                continue
            if not order.sattva_first_order:
                if order.sattva_compliance_hold:
                    order.sudo().write(
                        {
                            "sattva_compliance_hold": False,
                            "sattva_hold_reason": False,
                        }
                    )
                continue
            failures = order._first_order_failures()
            if failures:
                reason = "; ".join(failures)
                vals = {
                    "sattva_compliance_hold": True,
                    "sattva_hold_reason": reason[:255],
                }
                newly_held = not order.sattva_compliance_hold
                order.sudo().write(vals)
                if newly_held:
                    order._create_hold_activity(reason)
            elif order.sattva_compliance_hold:
                order.sudo().write(
                    {
                        "sattva_compliance_hold": False,
                        "sattva_hold_reason": False,
                    }
                )

    def _create_hold_activity(self, reason):
        self.ensure_one()
        todo = self.env.ref("mail.mail_activity_data_todo", raise_if_not_found=False)
        if not todo:
            return
        try:
            user = self.env["sattva.fabric.notify"]._role_assignee("compliance.officer")
        except UserError:
            return
        self.env["mail.activity"].sudo().create(
            {
                "activity_type_id": todo.id,
                "res_model_id": self.env["ir.model"]._get("sale.order").id,
                "res_id": self.id,
                "summary": f"SATTVA: First-order compliance hold ({reason})",
                "user_id": user.id,
            }
        )
