from odoo import api, models
from odoo.exceptions import UserError


class FabricNotify(models.AbstractModel):
    _name = "sattva.fabric.notify"
    _description = "Create Odoo activities for fabric role notifications"

    @api.model
    def create_role_activity(self, lead_id, summary, role):
        allowed = {
            "sales.exec",
            "compliance.officer",
            "finance.manager",
            "logistics.exec",
            "it.admin",
        }
        if role not in allowed:
            raise UserError("unknown notify role")
        lead = self.env["crm.lead"].browse(int(lead_id))
        if not lead.exists():
            raise UserError("lead not found")
        todo = self.env.ref("mail.mail_activity_data_todo")
        user = self.env.user
        if role == "sales.exec":
            sales = self.env.ref("sales_team.group_sale_salesman").users[:1]
            if sales:
                user = sales[0]
        return self.env["mail.activity"].sudo().create(
            {
                "activity_type_id": todo.id,
                "res_model_id": self.env["ir.model"]._get("crm.lead").id,
                "res_id": lead.id,
                "summary": f"SATTVA: {summary}",
                "user_id": user.id,
            }
        )
