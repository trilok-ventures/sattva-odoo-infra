from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestSattvaLotGreen(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_lot",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.product = cls.env["product.product"].create(
            {
                "name": "SYNTHETIC-ONION-FLAKE",
                "default_code": "ONION-FLAKE-A",
                "sattva_moisture_max": 6.0,
                "sattva_mesh_required": True,
                "sattva_salmonella_required": True,
                "sattva_tpc_max": 100000,
                "sattva_pyruvic_min": 30.0,
            }
        )

    def test_write_green_quarantine_without_spec_pass(self):
        bare = self.env["product.product"].create(
            {"name": "SYNTHETIC-BARE", "default_code": "BARE-LOT"}
        )
        result = (
            self.env["sattva.lot"]
            .with_user(self.fabric_user)
            .write_green(
                {
                    "filename": "BARE-LOT.pdf",
                    "sku": "BARE-LOT",
                    "product_id": bare.id,
                    "sha256": "a" * 64,
                    "moisture_pct": 4.8,
                    "mesh_pass": True,
                }
            )
        )
        lot = self.env["sattva.lot"].browse(result["id"])
        self.assertEqual(lot.state, "quarantine")
        self.assertFalse(lot.coa_pass)

    def test_write_green_passes_against_product_spec(self):
        result = (
            self.env["sattva.lot"]
            .with_user(self.fabric_user)
            .write_green(
                {
                    "sku": "ONION-FLAKE-A",
                    "product_id": self.product.id,
                    "sha256": "b" * 64,
                    "moisture_pct": 4.8,
                    "mesh_pass": True,
                    "salmonella_absent": True,
                    "tpc_cfu_g": 80000,
                    "pyruvic_acid_umol": 35.0,
                }
            )
        )
        lot = self.env["sattva.lot"].browse(result["id"])
        self.assertTrue(lot.coa_pass)
        self.assertEqual(lot.state, "available")
        self.assertEqual(lot.coa_sha256, "b" * 64)

    def test_write_green_rejects_red_keys(self):
        with self.assertRaises(UserError):
            self.env["sattva.lot"].with_user(self.fabric_user).write_green(
                {
                    "sku": "ONION-FLAKE-A",
                    "sha256": "c" * 64,
                    "path": "/Suppliers/secret.pdf",
                }
            )
