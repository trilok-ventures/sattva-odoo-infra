from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestVaultPath(TransactionCase):
    def test_set_supplier_path_does_not_change_pcp(self):
        partner = self.env["res.partner"].create(
            {"name": "Synthetic Vault Mill", "supplier_rank": 1}
        )
        self.assertEqual(partner.supplier_pcp_status, "pending")
        self.env["sattva.fabric.vault"].set_partner_path(
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
