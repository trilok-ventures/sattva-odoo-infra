from odoo import models, fields

class ResPartner(models.Model):
    _inherit = 'res.partner'

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
