from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestVaultPath(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_vault",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.unauthorized_user = new_test_user(
            cls.env,
            login="synthetic_non_fabric_vault",
            groups="base.group_user",
        )

    def test_set_supplier_path_does_not_change_pcp(self):
        partner = self.env["res.partner"].create(
            {"name": "Synthetic Vault Mill", "supplier_rank": 1}
        )
        self.assertEqual(partner.supplier_pcp_status, "pending")
        self.env["sattva.fabric.vault"].with_user(self.fabric_user).set_partner_path(
            partner.id, "/Suppliers/Synthetic_Vault_Mill/Certificates/", "supplier"
        )
        self.assertEqual(
            partner.nextcloud_folder_path,
            "/Suppliers/Synthetic_Vault_Mill/Certificates/",
        )
        self.assertEqual(partner.supplier_pcp_status, "pending")

    def test_set_partner_path_rejects_unknown_kind(self):
        partner = self.env["res.partner"].create({"name": "Synthetic Vault X"})
        with self.assertRaises(UserError):
            self.env["sattva.fabric.vault"].set_partner_path(
                partner.id, "/tmp/nope", "inbox"
            )

    def test_set_partner_path_rejects_non_service_user(self):
        partner = self.env["res.partner"].create({"name": "Synthetic Vault Denied"})
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.vault"].with_user(
                self.unauthorized_user
            ).set_partner_path(
                partner.id,
                "/Suppliers/Synthetic_Vault_Denied/Certificates/",
                "supplier",
            )
