from odoo.exceptions import AccessError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestLeadGreenScore(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_leadscore",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.unauthorized_user = new_test_user(
            cls.env,
            login="synthetic_non_fabric_leadscore",
            groups="base.group_user",
        )

    def test_green_score_fields_require_no_pii(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-LEAD"})
        self.env["sattva.fabric.leadscore"].with_user(
            self.fabric_user
        ).write_score(lead.id, 0.81, True)
        lead.invalidate_recordset()
        self.assertEqual(lead.sattva_green_score, 0.81)
        self.assertTrue(lead.sattva_lead_qualified)
        self.assertFalse(lead.description)

    def test_green_score_rejects_non_service_user(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-LEAD-DENIED"})
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.leadscore"].with_user(
                self.unauthorized_user
            ).write_score(lead.id, 0.5, False)
