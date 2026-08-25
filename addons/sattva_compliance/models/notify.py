from datetime import timedelta

from odoo import api, fields, models
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

ASSUMED_OCEAN_TRANSIT_DAYS = 45
REPLENISHMENT_SUMMARY_PREFIX = "Replenishment nudge"


def replenishment_summary(order_name):
    return f"{REPLENISHMENT_SUMMARY_PREFIX} [{order_name}]"


class FabricNotify(models.AbstractModel):
    _name = "sattva.fabric.notify"
    _description = "Create Odoo activities for fabric role notifications"

    @api.model
    def _activity_vals(self, res_model, res_id, summary, role, date_deadline=None):
        require_n8n_fabric_service(self.env)
        if role not in ROLE_GROUPS:
            raise UserError("unknown notify role")
        todo = self.env.ref("mail.mail_activity_data_todo")
        user = self._role_assignee(role)
        vals = {
            "activity_type_id": todo.id,
            "res_model_id": self.env["ir.model"]._get(res_model).id,
            "res_id": res_id,
            "summary": f"SATTVA: {summary}",
            "user_id": user.id,
        }
        if date_deadline:
            vals["date_deadline"] = date_deadline
        return vals

    @api.model
    def create_role_activity(self, lead_id, summary, role):
        require_n8n_fabric_service(self.env)
        lead = self.env["crm.lead"].browse(int(lead_id))
        if not lead.exists():
            raise UserError("lead not found")
        return self.env["mail.activity"].sudo().create(
            self._activity_vals("crm.lead", lead.id, summary, role)
        )

    @api.model
    def create_partner_role_activity(
        self, partner_id, summary, role, date_deadline=None
    ):
        require_n8n_fabric_service(self.env)
        partner = self.env["res.partner"].browse(int(partner_id))
        if not partner.exists():
            raise UserError("partner not found")
        buyer = partner.commercial_partner_id
        return self.env["mail.activity"].sudo().create(
            self._activity_vals(
                "res.partner", buyer.id, summary, role, date_deadline
            )
        )

    @api.model
    def scan_replenishment_nudges(self, partner_id=False):
        require_n8n_fabric_service(self.env)
        domain = [("state", "in", ("sale", "done"))]
        if partner_id not in (False, None, 0, "0"):
            partner = self.env["res.partner"].browse(int(partner_id))
            if not partner.exists():
                raise UserError("partner not found")
            domain.append(
                ("partner_id", "child_of", partner.commercial_partner_id.ids)
            )
        orders = self.env["sale.order"].sudo().search(
            domain, order="date_order desc, id desc"
        )
        today = fields.Date.context_today(self)
        created = []
        seen = set()
        for order in orders:
            buyer = order.partner_id.commercial_partner_id
            if buyer.id in seen:
                continue
            seen.add(buyer.id)
            row = self._nudge_last_confirmed_so(buyer, order, today)
            if row:
                created.append(row)
        return created

    def _nudge_last_confirmed_so(self, buyer, order, today):
        if buyer.customer_rank <= 0 or not order.date_order:
            return None
        if buyer.sattva_replenishment_nudge_so_id.id == order.id:
            return None
        due = fields.Date.to_date(order.date_order) + timedelta(
            days=ASSUMED_OCEAN_TRANSIT_DAYS
        )
        if due > today:
            return None
        summary = replenishment_summary(order.name)
        existing = (
            self.env["mail.activity"]
            .sudo()
            .search(
                [
                    ("res_model", "=", "res.partner"),
                    ("res_id", "=", buyer.id),
                    ("summary", "=", f"SATTVA: {summary}"),
                ],
                limit=1,
            )
        )
        if existing:
            self._mark_nudged(buyer, order)
            return None
        activity = self.create_partner_role_activity(
            buyer.id, summary, "sales.exec", due
        )
        self._mark_nudged(buyer, order)
        return {
            "activity_id": activity.id,
            "partner_id": buyer.id,
            "sale_order_id": order.id,
        }

    def _mark_nudged(self, buyer, order):
        buyer.sudo().with_context(sattva_replenishment_scan=True).write(
            {"sattva_replenishment_nudge_so_id": order.id}
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
