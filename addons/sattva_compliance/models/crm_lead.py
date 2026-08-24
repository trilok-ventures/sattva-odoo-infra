from odoo import fields, models


class CrmLead(models.Model):
    _inherit = "crm.lead"

    sattva_green_score = fields.Float(string="GREEN Lead Score", readonly=True)
    sattva_lead_qualified = fields.Boolean(string="Pitch Qualified", readonly=True)
    sattva_product_family_code = fields.Char(
        string="Inbound product family",
        readonly=True,
        help="GREEN technical-content family from the public inbound form.",
    )
    sattva_fcl_band = fields.Char(
        string="Inbound FCL band",
        readonly=True,
        help="GREEN volume band from the public inbound form.",
    )
    sattva_inbound_topic = fields.Char(
        string="Inbound content topic",
        readonly=True,
        help="GREEN topic: sfcr, coa_spec, or steam_sterilization.",
    )
