from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestCoaSidecar(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_sidecar",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.unauthorized = new_test_user(
            cls.env,
            login="synthetic_sidecar_denied",
            groups="base.group_user",
        )
        cls.supplier = cls.env["res.partner"].create(
            {"name": "Synthetic Sidecar Mill", "supplier_rank": 1}
        )
        cls.env["sattva.fabric.vault"].with_user(cls.fabric_user).set_partner_path(
            cls.supplier.id,
            "/Suppliers/Synthetic_Sidecar_Mill/Certificates/",
            "supplier",
        )
        cls.lot = cls.env["sattva.brokerage.lot"].create(
            {
                "name": "SYN-SIDECAR-001",
                "supplier_id": cls.supplier.id,
            }
        )

    def _resolve(self, basename="coa.pdf.green.json", user=None):
        user = user or self.fabric_user
        return (
            self.env["sattva.fabric.lot"]
            .with_user(user)
            .resolve_coa_sidecar(self.lot.id, basename)
        )

    def test_resolve_coa_sidecar_under_supplier_certificates(self):
        row = self._resolve()
        self.assertEqual(row["lot_id"], self.lot.id)
        self.assertEqual(row["sidecar_basename"], "coa.pdf.green.json")
        self.assertEqual(
            row["vault_href"],
            "/Suppliers/Synthetic_Sidecar_Mill/Certificates/coa.pdf.green.json",
        )
        self.assertTrue(row["vault_href"].endswith(".green.json"))
        self.assertFalse(row["vault_href"].endswith(".pdf"))

    def test_resolve_coa_sidecar_rejects_pdf_basename(self):
        with self.assertRaises(UserError):
            self._resolve("coa.pdf")

    def test_resolve_coa_sidecar_rejects_path_basename(self):
        with self.assertRaises(UserError):
            self._resolve("../coa.pdf.green.json")

    def test_resolve_coa_sidecar_rejects_missing_folder(self):
        bare = self.env["res.partner"].create(
            {"name": "Synthetic Sidecar Bare", "supplier_rank": 1}
        )
        lot = self.env["sattva.brokerage.lot"].create(
            {"name": "SYN-SIDECAR-BARE", "supplier_id": bare.id}
        )
        with self.assertRaises(UserError):
            self.env["sattva.fabric.lot"].with_user(self.fabric_user).resolve_coa_sidecar(
                lot.id, "coa.pdf.green.json"
            )

    def test_resolve_coa_sidecar_rejects_non_service_user(self):
        with self.assertRaises(AccessError):
            self._resolve(user=self.unauthorized)
