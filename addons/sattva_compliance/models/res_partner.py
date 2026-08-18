import re

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model_create_multi
    def create(self, vals_list):
        partners = super().create(vals_list)
        events = []
        for partner in partners.filtered(lambda record: record.supplier_rank > 0):
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
