from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestLeadInbound(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_lead_inbound",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.unauthorized = new_test_user(
            cls.env,
            login="synthetic_lead_inbound_denied",
            groups="base.group_user",
        )

    def _ingest(self, **vals):
        values = {
            "contact_name": "Alex Rivera",
            "work_email": "alex@example.com",
            "company_name": "Riverbank Foods",
            "product_family_code": "ONION",
            "fcl_band": "2_5",
            "content_topic": "sfcr",
        }
        values.update(vals)
        return self.env["sattva.fabric.lead.ingest"].with_user(
            self.fabric_user
        ).create_inbound(
            values["contact_name"],
            values["work_email"],
            values["company_name"],
            values["product_family_code"],
            values["fcl_band"],
            values["content_topic"],
        )

    def test_ingest_creates_lead_without_user(self):
        users_before = self.env["res.users"].search_count([])
        lead_id = self._ingest()
        lead = self.env["crm.lead"].browse(lead_id)
        self.assertTrue(lead.exists())
        self.assertEqual(lead.type, "lead")
        self.assertEqual(lead.email_from, "alex@example.com")
        self.assertEqual(lead.partner_name, "Riverbank Foods")
        self.assertEqual(lead.sattva_product_family_code, "ONION")
        self.assertEqual(lead.sattva_fcl_band, "2_5")
        self.assertEqual(lead.sattva_inbound_topic, "sfcr")
        self.assertFalse(lead.sattva_lead_qualified)
        self.assertEqual(self.env["res.users"].search_count([]), users_before)
        self.assertFalse(
            self.env["res.users"].search([("login", "=", "alex@example.com")])
        )

    def test_ingest_rejects_unknown_family(self):
        with self.assertRaises(UserError):
            self._ingest(product_family_code="BEEF")

    def test_ingest_rejects_bad_email(self):
        with self.assertRaises(UserError):
            self._ingest(work_email="not-an-email")
        with self.assertRaises(UserError):
            self._ingest(work_email="a@b")

    def test_ingest_rejects_non_service_user(self):
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.lead.ingest"].with_user(
                self.unauthorized
            ).create_inbound(
                "Alex Rivera",
                "alex@example.com",
                "Riverbank Foods",
                "ONION",
                "2_5",
                "sfcr",
            )

    def test_score_payload_stays_green(self):
        lead_id = self._ingest()
        self.env["sattva.fabric.leadscore"].with_user(self.fabric_user).write_score(
            lead_id, 0.2, False
        )
        lead = self.env["crm.lead"].browse(lead_id)
        self.assertEqual(lead.sattva_green_score, 0.2)
        self.assertFalse(lead.sattva_lead_qualified)
