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
        help="Do not set supplier_rank on a forwarder. That would queue supplier vault folders and the PCP PO gate.",
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
