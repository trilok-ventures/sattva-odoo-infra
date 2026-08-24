from odoo import api, fields, models
from odoo.exceptions import AccessError


class SattvaPaymentScore(models.Model):
    _name = "sattva.payment.score"
    _description = "Sattva payment score snapshot"
    _order = "id desc"

    partner_id = fields.Many2one(
        "res.partner",
        required=True,
        ondelete="cascade",
        index=True,
        readonly=True,
    )
    score_p = fields.Integer(string="Punctuality P", readonly=True)
    score_v = fields.Integer(string="Volume V", readonly=True)
    score_m = fields.Integer(string="Market M", readonly=True)
    score_f = fields.Integer(string="Financial F", readonly=True)
    score_r = fields.Integer(string="Paydex R", readonly=True)
    score_total = fields.Integer(string="Score S", readonly=True)
    credit_risk_tier = fields.Selection(
        [
            ("1", "Tier 1"),
            ("2", "Tier 2"),
            ("3", "Tier 3"),
            ("4", "Tier 4"),
        ],
        string="Credit risk tier",
        readonly=True,
    )
    fcl_sum = fields.Integer(string="Confirmed FCL sum", readonly=True)
    invoice_count = fields.Integer(string="Posted invoice count", readonly=True)

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.context.get("sattva_score_snapshot"):
            raise AccessError("Payment score rows are snapshots only.")
        return super().create(vals_list)

    def write(self, vals):
        raise AccessError("Payment score snapshots are read-only.")
