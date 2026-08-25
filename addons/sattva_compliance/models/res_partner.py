import re

from odoo import api, fields, models
from odoo.exceptions import AccessError, ValidationError

from .credit_access import check_partner_credit_vals, is_finance_manager, is_n8n
from .credit_formula import (
    composite_score,
    credit_tier,
    invoice_dbt_days,
    score_market,
    score_punctuality,
    score_volume,
)
from .service_security import require_n8n_fabric_service

_SNAPSHOT_FIELDS = (
    "payment_score_financial",
    "payment_score_paydex",
    "industry_sector",
)


def _check_replenishment_nudge_write(env, vals):
    if "sattva_replenishment_nudge_so_id" not in vals:
        return
    if not env.context.get("sattva_replenishment_scan"):
        raise AccessError(
            "Replenishment nudge pointer is written only by the scan helper."
        )
    require_n8n_fabric_service(env)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model_create_multi
    def create(self, vals_list):
        prepared = []
        for vals in vals_list:
            _check_replenishment_nudge_write(self.env, vals)
            check_partner_credit_vals(self.env, vals)
            credit_vals = {
                field: vals[field] for field in _SNAPSHOT_FIELDS if field in vals
            }
            other_vals = {
                key: value for key, value in vals.items() if key not in credit_vals
            }
            prepared.append((other_vals, credit_vals))
        partners = super().create([other_vals for other_vals, _credit in prepared])
        events = []
        for partner in partners.filtered(
            lambda record: record.supplier_rank > 0 and not record.is_logistics_partner
        ):
            folder_name = re.sub(r"\W+", "_", partner.name).strip("_")
            events.append(
                {
                    "event_type": "supplier_folder_requested",
                    "partner_id": partner.id,
                    "requested_path": f"/Suppliers/{folder_name}/Certificates/",
                }
            )
        for partner in partners.filtered(lambda record: record.customer_rank > 0):
            folder_name = re.sub(r"\W+", "_", partner.name).strip("_")
            events.append(
                {
                    "event_type": "buyer_folder_requested",
                    "partner_id": partner.id,
                    "requested_path": f"/Clients/{folder_name}/Onboarding/",
                }
            )
        if events:
            self.env["sattva.fabric.event"].sudo().create(events)
        snapshot_roots = self.env["res.partner"]
        for partner, (_other_vals, credit_vals) in zip(partners, prepared):
            if not credit_vals:
                continue
            root = partner.commercial_partner_id
            super(ResPartner, root).write(credit_vals)
            snapshot_roots |= root
        if snapshot_roots:
            snapshot_roots._sattva_snapshot_payment_score()
        return partners

    supplier_pcp_status = fields.Selection([
        ('pending', 'Pending Onboarding'),
        ('review', 'Under Compliance Review'),
        ('approved', 'PCP Approved'),
        ('blocked', 'Blocked / Non-Compliant')
    ], string="PCP Compliance Status", default='pending', tracking=True, help="Supplier must be Approved to confirm a PO.")

    risk_band = fields.Selection([
        ('low', 'Low Risk'),
        ('medium', 'Medium Risk'),
        ('high', 'High Risk')
    ], string="Risk Band", default='medium', tracking=True)

    haccp_certified = fields.Boolean(string="HACCP Certified", default=False)
    brc_certified = fields.Boolean(string="BRC Certified", default=False)
    
    # Hidden backend link for the API to know where to upload/retrieve files
    nextcloud_folder_path = fields.Char(string="Nextcloud Vault Path", readonly=True, help="Path in Nextcloud for compliance docs.")

    buyer_kyc_status = fields.Selection(
        [
            ("pending", "Pending KYC"),
            ("review", "KYC Review"),
            ("complete", "KYC Complete"),
            ("blocked", "KYC Blocked"),
        ],
        string="Buyer KYC Status",
        default="pending",
        tracking=True,
        help="Buyer onboarding completeness. Never used by purchase.order.button_confirm.",
    )

    nextcloud_client_folder_path = fields.Char(
        string="Nextcloud Client Vault Path",
        readonly=True,
        help="Path in Nextcloud for buyer onboarding docs. Separate from supplier nextcloud_folder_path.",
    )

    buyer_sfc_status = fields.Selection(
        [
            ("pending", "SFC Pending"),
            ("active", "SFC Active"),
            ("suspended", "SFC Suspended"),
            ("expired", "SFC Expired"),
        ],
        string="Buyer SFC Status",
        default="pending",
        tracking=True,
        help="Safe Food for Canadians licence. Gates sale.order confirm, never purchase.order.",
    )
    buyer_sfc_licence = fields.Char(
        string="SFC licence number",
        help="AMBER identifier only. Licence PDF stays in Nextcloud.",
    )
    sattva_replenishment_nudge_so_id = fields.Many2one(
        "sale.order",
        string="Last replenishment-nudge SO",
        readonly=True,
        ondelete="set null",
        help="AMBER pointer to the last confirmed SO that already opened a "
        "CRM replenishment activity. Not inventory.",
    )

    spices_board_rcm = fields.Char(string="Spices Board RCM")
    fssai_licence = fields.Char(string="FSSAI licence")
    us_fda_fei = fields.Char(string="US FDA FEI (optional)")
    steam_sterilization_cap = fields.Boolean(
        string="Steam sterilization capacity", default=False
    )
    last_audit_date = fields.Date(string="Last audit date")

    is_logistics_partner = fields.Boolean(
        string="Logistics / 3PL partner",
        default=False,
        help="Do not set supplier_rank on a forwarder. That would queue mill vault folders and the PCP PO gate.",
    )
    forwarder_status = fields.Selection(
        [
            ("pending", "Forwarder Pending"),
            ("approved", "Forwarder Approved"),
            ("blocked", "Forwarder Blocked"),
        ],
        string="Forwarder Status",
        default="pending",
        tracking=True,
    )
    cbsa_bond_ref = fields.Char(
        string="CBSA bond pointer",
        help="AMBER reference. Bond PDF stays in Nextcloud.",
    )
    insurance_coverage_ref = fields.Char(
        string="Insurance coverage pointer",
        help="AMBER reference. Policy PDF stays in Nextcloud.",
    )
    cfia_swi_capable = fields.Boolean(string="CFIA SWI capable", default=False)
    incoterm_fob = fields.Boolean(string="Supports FOB", default=False)
    incoterm_cif = fields.Boolean(string="Supports CIF", default=False)
    incoterm_dap = fields.Boolean(string="Supports DAP", default=False)

    industry_sector = fields.Selection(
        [
            ("food_service", "Food service"),
            ("retail", "Retail"),
            ("manufacturing", "Manufacturing"),
            ("other", "Other"),
        ],
        string="Industry sector",
        tracking=True,
        help="Finance manager only. Stored on the commercial partner.",
    )
    payment_score_financial = fields.Integer(
        string="Financial score F",
        default=50,
        tracking=True,
        help="Manual 0-100. Finance manager only. Not a live bureau pull. Stored on the commercial partner.",
    )
    payment_score_paydex = fields.Integer(
        string="Paydex stand-in R",
        default=50,
        tracking=True,
        help="Manual 0-100 until a dated finance spec wires D&B. Finance manager only. Stored on the commercial partner.",
    )
    payment_score_punctuality = fields.Integer(
        string="Punctuality P", compute="_compute_credit_scores"
    )
    payment_score_volume = fields.Integer(
        string="Volume V", compute="_compute_credit_scores"
    )
    payment_score_market = fields.Integer(
        string="Market M", compute="_compute_credit_scores"
    )
    payment_score_total = fields.Integer(
        string="Credit score S", compute="_compute_credit_scores"
    )
    credit_risk_tier = fields.Selection(
        [
            ("1", "Tier 1"),
            ("2", "Tier 2"),
            ("3", "Tier 3"),
            ("4", "Tier 4"),
        ],
        string="Credit risk tier",
        compute="_compute_credit_scores",
    )

    def write(self, vals):
        _check_replenishment_nudge_write(self.env, vals)
        check_partner_credit_vals(self.env, vals)
        credit_vals = {field: vals[field] for field in _SNAPSHOT_FIELDS if field in vals}
        other_vals = {key: value for key, value in vals.items() if key not in credit_vals}
        result = True
        if other_vals:
            result = super().write(other_vals)
        if credit_vals:
            roots = self.mapped("commercial_partner_id")
            super(ResPartner, roots).write(credit_vals)
            roots._sattva_snapshot_payment_score()
        return result

    def copy_data(self, default=None):
        vals_list = super().copy_data(default)
        for vals in vals_list:
            vals.pop("sattva_replenishment_nudge_so_id", None)
            if is_finance_manager(self.env):
                continue
            for field in _SNAPSHOT_FIELDS:
                vals.pop(field, None)
        return vals_list

    def action_recompute_payment_score(self):
        if is_n8n(self.env):
            raise AccessError("n8n cannot compute or post credit scores.")
        self._sattva_snapshot_payment_score()
        return True

    def _sattva_credit_components(self):
        self.ensure_one()
        root = self.commercial_partner_id
        invoices = self.env["account.move"].sudo().search(
            [
                ("commercial_partner_id", "=", root.id),
                ("move_type", "=", "out_invoice"),
                ("state", "=", "posted"),
            ]
        )
        today = fields.Date.context_today(self)
        avg_dbt = 0
        if invoices:
            avg_dbt = sum(
                invoice_dbt_days(inv.payment_state, inv.invoice_date_due, today)
                for inv in invoices
            ) / len(invoices)
        punctuality = score_punctuality(len(invoices), avg_dbt)
        orders = self.env["sale.order"].sudo().search(
            [
                ("partner_id", "child_of", root.id),
                ("state", "in", ("sale", "done")),
            ]
        )
        fcl_sum = sum(orders.mapped("fcl_count"))
        volume = score_volume(fcl_sum)
        market = score_market(root.industry_sector)
        financial = root.payment_score_financial
        paydex = root.payment_score_paydex
        total = composite_score(punctuality, volume, market, financial, paydex)
        return (
            punctuality,
            volume,
            market,
            financial,
            paydex,
            total,
            credit_tier(total),
            fcl_sum,
            len(invoices),
        )

    def _compute_credit_scores(self):
        for partner in self:
            (
                punctuality,
                volume,
                market,
                _financial,
                _paydex,
                total,
                tier,
                _fcl,
                _invoices,
            ) = partner._sattva_credit_components()
            partner.payment_score_punctuality = punctuality
            partner.payment_score_volume = volume
            partner.payment_score_market = market
            partner.payment_score_total = total
            partner.credit_risk_tier = tier

    def _sattva_snapshot_payment_score(self):
        rows = []
        for partner in self:
            root = partner.commercial_partner_id
            (
                punctuality,
                volume,
                market,
                financial,
                paydex,
                total,
                tier,
                fcl_sum,
                invoice_count,
            ) = root._sattva_credit_components()
            rows.append(
                {
                    "partner_id": root.id,
                    "score_p": punctuality,
                    "score_v": volume,
                    "score_m": market,
                    "score_f": financial,
                    "score_r": paydex,
                    "score_total": total,
                    "credit_risk_tier": tier,
                    "fcl_sum": fcl_sum,
                    "invoice_count": invoice_count,
                }
            )
        if rows:
            self.env["sattva.payment.score"].sudo().with_context(
                sattva_score_snapshot=True
            ).create(rows)

    @api.constrains("payment_score_financial", "payment_score_paydex")
    def _check_manual_credit_scores(self):
        for partner in self:
            for field_name in ("payment_score_financial", "payment_score_paydex"):
                value = partner[field_name]
                if value < 0 or value > 100:
                    raise ValidationError("Credit scores must be between 0 and 100.")

    @api.constrains("is_logistics_partner", "supplier_rank")
    def _check_logistics_not_vendor(self):
        for partner in self:
            if partner.is_logistics_partner and partner.supplier_rank > 0:
                raise ValidationError(
                    "A logistics / 3PL partner cannot be a vendor (supplier_rank). "
                    "That would queue mill vault folders and the PCP PO gate."
                )
