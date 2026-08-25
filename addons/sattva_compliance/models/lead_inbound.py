import re

from odoo import api, models
from odoo.exceptions import UserError

from .service_security import require_n8n_fabric_service

_PRODUCT_FAMILY = frozenset({"ONION", "GARLIC", "CHILLI", "OTHER"})
_FCL_BAND = frozenset({"1", "2_5", "6_plus"})
_CONTENT_TOPIC = frozenset({"sfcr", "coa_spec", "steam_sterilization"})
_EMAIL_RE = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"


class FabricLeadIngest(models.AbstractModel):
    _name = "sattva.fabric.lead.ingest"
    _description = "Create inbound technical-content crm.lead rows"

    @api.model
    def create_inbound(
        self,
        contact_name,
        work_email,
        company_name,
        product_family_code,
        fcl_band,
        content_topic,
    ):
        require_n8n_fabric_service(self.env)
        contact = _require_label(contact_name, "contact_name")
        email = _require_email(work_email)
        company = _require_label(company_name, "company_name")
        if product_family_code not in _PRODUCT_FAMILY:
            raise UserError("unknown product_family_code")
        if fcl_band not in _FCL_BAND:
            raise UserError("unknown fcl_band")
        if content_topic not in _CONTENT_TOPIC:
            raise UserError("unknown content_topic")
        lead = self.env["crm.lead"].sudo().create(
            {
                "name": f"Inbound {product_family_code} {company}",
                "type": "lead",
                "contact_name": contact,
                "email_from": email,
                "partner_name": company,
                "sattva_product_family_code": product_family_code,
                "sattva_fcl_band": fcl_band,
                "sattva_inbound_topic": content_topic,
            }
        )
        return lead.id


def _require_label(value, field_name):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > 120:
        raise UserError(f"{field_name} must be a short string")
    return value.strip()


def _require_email(value):
    email = _require_label(value, "work_email").lower()
    if not re.fullmatch(_EMAIL_RE, email):
        raise UserError("work_email must be a short email")
    return email
