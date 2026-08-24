from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestProductSpec(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.sales = new_test_user(
            cls.env,
            login="synthetic_sales_catalog",
            groups="sales_team.group_sale_salesman",
        )
        cls.officer = new_test_user(
            cls.env,
            login="synthetic_compliance_spec",
            groups="sattva_compliance.group_compliance_officer,sales_team.group_sale_salesman",
        )

    def test_crop_sets_product_family_code(self):
        template = self.env["product.template"].create(
            {"name": "Synthetic Onion Catalog Row", "sattva_crop": "onion"}
        )
        self.assertEqual(template.product_family_code, "ONION")
        self.assertFalse(template.spec_moisture_max)

    def test_sales_can_create_catalog_row_without_spec(self):
        template = (
            self.env["product.template"]
            .with_user(self.sales)
            .create({"name": "Synthetic Sales Catalog Row", "sattva_crop": "chilli"})
        )
        self.assertEqual(template.product_family_code, "CHILLI")
        self.assertFalse(template.spec_mesh_required)

    def test_sales_cannot_write_spec_thresholds(self):
        template = self.env["product.template"].create(
            {"name": "Synthetic Garlic Catalog Row", "sattva_crop": "garlic"}
        )
        with self.assertRaises(UserError):
            template.with_user(self.sales).write({"spec_moisture_max": 6.0})
        template.with_user(self.sales).write({"sattva_format": "powder"})
        self.assertEqual(template.sattva_format, "powder")
        template.with_user(self.officer).write({"spec_moisture_max": 6.0})
        self.assertEqual(template.spec_moisture_max, 6.0)

    def test_crop_categories_exist(self):
        for xmlid in (
            "sattva_compliance.product_category_sattva",
            "sattva_compliance.product_category_onion",
            "sattva_compliance.product_category_garlic",
            "sattva_compliance.product_category_chilli",
            "sattva_compliance.product_category_turmeric",
        ):
            self.assertTrue(self.env.ref(xmlid).exists())
