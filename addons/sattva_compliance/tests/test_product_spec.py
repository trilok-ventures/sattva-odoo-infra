from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestProductGreenSpecs(TransactionCase):
    def test_onion_requires_pyruvic(self):
        onion = self.env["product.template"].create(
            {"name": "SYNTHETIC-ONION-FLAKE", "sattva_crop": "onion"}
        )
        garlic = self.env["product.template"].create(
            {"name": "SYNTHETIC-GARLIC-POWDER", "sattva_crop": "garlic"}
        )
        self.assertTrue(onion.spec_pyruvic_required)
        self.assertFalse(garlic.spec_pyruvic_required)
        self.assertTrue(onion.spec_salmonella_required)
        self.assertEqual(onion.spec_moisture_max, 6.0)
