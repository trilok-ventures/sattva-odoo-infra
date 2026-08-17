from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestLeadGreenScore(TransactionCase):
    def test_green_score_fields_require_no_pii(self):
        lead = self.env["crm.lead"].create({"name": "SYNTHETIC-LEAD"})
        lead.write({"sattva_green_score": 0.81, "sattva_lead_qualified": True})
        self.assertEqual(lead.sattva_green_score, 0.81)
        self.assertTrue(lead.sattva_lead_qualified)
        self.assertFalse(lead.description)
