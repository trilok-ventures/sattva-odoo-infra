from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestNotifyActivity(TransactionCase):
    def test_qualified_lead_creates_sales_activity(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-LEAD-NOTIFY"})
        activity = self.env["sattva.fabric.notify"].create_role_activity(
            lead.id,
            "Lead qualified for pitch",
            "sales.exec",
        )
        self.assertTrue(activity.id)
        self.assertEqual(activity.res_model, "crm.lead")
        self.assertEqual(activity.res_id, lead.id)
        self.assertTrue(activity.summary.startswith("SATTVA:"))
