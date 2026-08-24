import hashlib
import re

from odoo import api, fields, models
from odoo.exceptions import AccessError, ValidationError

PCP_WRITE_FIELDS = {
    "supplier_pcp_status",
    "risk_band",
    "haccp_certified",
    "brc_certified",
}
FORWARDER_WRITE_FIELDS = {
    "forwarder_status",
    "cfia_swi_capable",
    "insurance_meets_min",
    "supported_incoterms",
    "is_freight_forwarder",
}
SFC_WRITE_FIELDS = {
    "sfc_licence_status",
    "sfc_licence_input",
}
ALLOWED_INCOTERMS = {"FOB", "CIF", "DAP", "DDP"}


class ResPartner(models.Model):
    _inherit = "res.partner"

    @api.model_create_multi
    def create(self, vals_list):
        prepared = []
        for vals in vals_list:
            self._check_restricted_writes(vals)
            vals = dict(vals)
            raw = vals.pop("sfc_licence_input", None)
            if raw:
                vals.update(self._licence_store_vals(raw))
            prepared.append(vals)
        partners = super().create(prepared)
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

    def write(self, vals):
        self._check_restricted_writes(vals)
        if "sfc_licence_input" in vals:
            raw = vals.pop("sfc_licence_input")
            if raw:
                vals.update(self._licence_store_vals(raw))
        return super().write(vals)

    def _check_restricted_writes(self, vals):
        if self.env.is_superuser():
            return
        keys = set(vals)
        officer = self.env.user.has_group("sattva_compliance.group_compliance_officer")
        logistics = self.env.user.has_group("sattva_compliance.group_logistics_exec")
        if keys & PCP_WRITE_FIELDS and not officer:
            raise AccessError("Only a compliance officer may change PCP fields.")
        if keys & SFC_WRITE_FIELDS and not officer:
            raise AccessError("Only a compliance officer may change SFC licence fields.")
        if keys & FORWARDER_WRITE_FIELDS and not (officer or logistics):
            raise AccessError("Only logistics or compliance may change 3PL fields.")

    @api.model
    def _licence_store_vals(self, raw):
        normalized = re.sub(r"\s+", "", str(raw).strip().upper())
        if not normalized:
            return {
                "sfc_licence_fingerprint": False,
                "sfc_licence_masked": False,
            }
        last4 = normalized[-4:] if len(normalized) >= 4 else normalized
        return {
            "sfc_licence_fingerprint": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
            "sfc_licence_masked": f"••••{last4}",
        }

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

    sfc_licence_status = fields.Selection(
        [
            ("pending", "Pending"),
            ("active", "ACTIVE"),
            ("suspended", "SUSPENDED"),
            ("expired", "EXPIRED"),
        ],
        string="SFC licence status",
        default="pending",
        tracking=True,
        help="AMBER flag. KYC complete does not set this and does not bypass PCP.",
    )
    sfc_licence_fingerprint = fields.Char(
        string="SFC licence fingerprint",
        readonly=True,
        copy=False,
        help="SHA-256 of the normalized licence id. Plaintext is never stored.",
    )
    sfc_licence_masked = fields.Char(
        string="SFC licence (masked)",
        readonly=True,
        copy=False,
    )
    sfc_licence_input = fields.Char(
        string="Set SFC licence id",
        store=False,
        help="Write-only. Stores a SHA-256 fingerprint and last-4 mask. PDF stays in Nextcloud.",
    )

    is_freight_forwarder = fields.Boolean(string="3PL / freight forwarder")
    forwarder_status = fields.Selection(
        [
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("probation", "Probation"),
            ("inactive", "Inactive"),
        ],
        string="3PL status",
        default="pending",
        tracking=True,
    )
    cfia_swi_capable = fields.Boolean(
        string="CFIA SWI / IID capable",
        default=False,
        help="AMBER flag only. Do not store bond numbers here.",
    )
    insurance_meets_min = fields.Boolean(
        string="Marine insurance meets minimum",
        default=False,
        help="AMBER flag. Policy PDFs stay in Nextcloud; no policy numbers in Odoo.",
    )
    supported_incoterms = fields.Char(
        string="Supported Incoterms",
        help="Comma-separated FOB,CIF,DAP,DDP. Empty means none declared.",
    )

    @api.constrains("supported_incoterms")
    def _check_supported_incoterms(self):
        for partner in self:
            raw = partner.supported_incoterms
            if not raw:
                continue
            tokens = [token.strip().upper() for token in raw.split(",") if token.strip()]
            bad = [token for token in tokens if token not in ALLOWED_INCOTERMS]
            if bad:
                raise ValidationError(
                    "supported_incoterms must be a comma-separated subset of FOB,CIF,DAP,DDP."
                )
