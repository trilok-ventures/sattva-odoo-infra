from odoo import fields, models


class CrmLead(models.Model):
    _inherit = "crm.lead"

    sattva_green_score = fields.Float(string="GREEN Lead Score", readonly=True)
    sattva_lead_qualified = fields.Boolean(string="Pitch Qualified", readonly=True)
