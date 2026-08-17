import math

from odoo import api, models
from odoo.exceptions import UserError

from .service_security import require_n8n_fabric_service


class FabricLeadScore(models.AbstractModel):
    _name = "sattva.fabric.leadscore"
    _description = "Write only GREEN lead score fields"

    @api.model
    def write_score(self, lead_id, score, qualified):
        require_n8n_fabric_service(self.env)
        if (
            isinstance(score, bool)
            or not isinstance(score, (int, float))
            or not math.isfinite(score)
            or not 0 <= score <= 1
        ):
            raise UserError("score must be a number from 0 to 1")
        if not isinstance(qualified, bool):
            raise UserError("qualified must be boolean")
        lead = self.env["crm.lead"].browse(int(lead_id))
        if not lead.exists():
            raise UserError("lead not found")
        lead.sudo().write(
            {
                "sattva_green_score": score,
                "sattva_lead_qualified": qualified,
            }
        )
        return True
