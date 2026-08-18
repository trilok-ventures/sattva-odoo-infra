from odoo import api, models
from odoo.exceptions import UserError

from .service_security import require_n8n_fabric_service


ROLE_GROUPS = {
    "sales.exec": ("sales_team.group_sale_salesman",),
    "finance.manager": (
        "account.group_account_manager",
        "account.group_account_user",
    ),
    "logistics.exec": ("stock.group_stock_user",),
    "it.admin": ("base.group_system",),
    "compliance.officer": ("sattva_compliance.group_compliance_officer",),
}


class FabricNotify(models.AbstractModel):
    _name = "sattva.fabric.notify"
    _description = "Create Odoo activities for fabric role notifications"

    @api.model
    def create_role_activity(self, lead_id, summary, role):
        require_n8n_fabric_service(self.env)
        if role not in ROLE_GROUPS:
            raise UserError("unknown notify role")
        lead = self.env["crm.lead"].browse(int(lead_id))
        if not lead.exists():
            raise UserError("lead not found")
        todo = self.env.ref("mail.mail_activity_data_todo")
        user = self._role_assignee(role)
        return self.env["mail.activity"].sudo().create(
            {
                "activity_type_id": todo.id,
                "res_model_id": self.env["ir.model"]._get("crm.lead").id,
                "res_id": lead.id,
                "summary": f"SATTVA: {summary}",
                "user_id": user.id,
            }
        )

    @api.model
    def _role_assignee(self, role):
        for group_xmlid in ROLE_GROUPS[role]:
            group = self.env.ref(group_xmlid, raise_if_not_found=False)
            if not group:
                continue
            candidates = group.sudo().users.filtered(
                lambda user: user.active
                and not user.share
                and not user.has_group(
                    "sattva_compliance.group_n8n_fabric_service"
                )
            )
            if candidates:
                return candidates.sorted("id")[0]
        if (
            role == "compliance.officer"
            and self.env.is_superuser()
            and self.env.user.active
            and not self.env.user.share
            and not self.env.user.has_group(
                "sattva_compliance.group_n8n_fabric_service"
            )
        ):
            return self.env.user
        raise UserError(f"no eligible human assignee for {role}")
