from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestPartnerFormView(TransactionCase):
    def test_partner_form_exposes_pcp_fields(self):
        view = self.env.ref("sattva_compliance.view_partner_form_sattva_compliance")
        arch = view.arch_db or view.arch
        for name in (
            "supplier_pcp_status",
            "risk_band",
            "haccp_certified",
            "brc_certified",
            "nextcloud_folder_path",
            "sfc_licence_status",
            "sfc_licence_masked",
            "is_freight_forwarder",
            "forwarder_status",
            "cfia_swi_capable",
            "insurance_meets_min",
            "supported_incoterms",
        ):
            self.assertIn(name, arch)

    def test_pcp_fields_are_on_partner_form(self):
        partner = self.env["res.partner"].create(
            {"name": "Synthetic PCP View Mill", "supplier_rank": 1}
        )
        arch = self.env["res.partner"].get_view(
            self.env.ref("base.view_partner_form").id, "form"
        )["arch"]
        self.assertIn("sattva_compliance", arch)
        self.assertIn("supplier_pcp_status", arch)
        self.assertEqual(partner.supplier_pcp_status, "pending")
