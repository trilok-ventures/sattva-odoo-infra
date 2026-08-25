from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestLeadFormView(TransactionCase):
    def test_lead_form_exposes_green_score_fields(self):
        view = self.env.ref("sattva_compliance.view_crm_lead_form_sattva")
        arch = view.arch_db or view.arch
        self.assertIn("sattva_green_score", arch)
        self.assertIn("sattva_lead_qualified", arch)
        self.assertIn("readonly", arch)
