from odoo import fields, models


class SattvaPaymentScore(models.Model):
    _name = "sattva.payment.score"
    _description = "Sattva payment score snapshot"
    _order = "id desc"

    partner_id = fields.Many2one(
        "res.partner",
        required=True,
        ondelete="cascade",
        index=True,
    )
    score_p = fields.Integer(string="Punctuality P")
    score_v = fields.Integer(string="Volume V")
    score_m = fields.Integer(string="Market M")
    score_f = fields.Integer(string="Financial F")
    score_r = fields.Integer(string="Paydex R")
    score_total = fields.Integer(string="Score S")
    credit_risk_tier = fields.Selection(
        [
            ("1", "Tier 1"),
            ("2", "Tier 2"),
            ("3", "Tier 3"),
            ("4", "Tier 4"),
        ],
        string="Credit risk tier",
    )
    fcl_sum = fields.Integer(string="Confirmed FCL sum")
    invoice_count = fields.Integer(string="Posted invoice count")
