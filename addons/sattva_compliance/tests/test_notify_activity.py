from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestNotifyActivity(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_notify",
            groups=(
                "sattva_compliance.group_n8n_fabric_service,"
                "sattva_compliance.group_compliance_officer"
            ),
        )
        cls.sales_user = new_test_user(
            cls.env,
            login="synthetic_human_sales_assignee",
            groups="sales_team.group_sale_salesman",
        )
        cls.unauthorized_user = new_test_user(
            cls.env,
            login="synthetic_non_fabric_notify",
            groups="base.group_user",
        )

    def test_qualified_lead_creates_sales_activity(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-LEAD-NOTIFY"})
        activity = (
            self.env["sattva.fabric.notify"]
            .with_user(self.fabric_user)
            .create_role_activity(
                lead.id,
                "Lead qualified for pitch",
                "sales.exec",
            )
        )
        self.assertTrue(activity.id)
        self.assertEqual(activity.res_model, "crm.lead")
        self.assertEqual(activity.res_id, lead.id)
        self.assertTrue(activity.summary.startswith("SATTVA:"))
        self.assertFalse(
            activity.user_id.has_group(
                "sattva_compliance.group_n8n_fabric_service"
            )
        )

    def test_notify_rejects_non_service_user(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-NOTIFY-DENIED"})
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.notify"].with_user(
                self.unauthorized_user
            ).create_role_activity(lead.id, "Denied", "sales.exec")

    def test_notify_rejects_service_user_as_compliance_assignee(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-NO-HUMAN-COMPLIANCE"})
        with self.assertRaises(UserError):
            self.env["sattva.fabric.notify"].with_user(
                self.fabric_user
            ).create_role_activity(
                lead.id,
                "Compliance review required",
                "compliance.officer",
            )
