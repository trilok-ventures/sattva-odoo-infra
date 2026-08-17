from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestOrderHandoff(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_handoff",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.unauthorized_user = new_test_user(
            cls.env,
            login="synthetic_non_fabric_handoff",
            groups="base.group_user",
        )

    def test_handoff_creates_draft_and_does_not_confirm_pending_supplier(self):
        supplier = self.env["res.partner"].create(
            {"name": "Synthetic Handoff Mill", "supplier_rank": 1}
        )
        product = self.env["product.product"].create({"name": "SYNTHETIC-GARLIC"})
        po = (
            self.env["sattva.fabric.handoff"]
            .with_user(self.fabric_user)
            .create_po_intent(
                supplier.id,
                [{"product_id": product.id, "product_qty": 1, "price_unit": 1.0}],
            )
        )
        self.assertEqual(po.state, "draft")
        with self.assertRaises(UserError) as err:
            po.button_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))

    def test_handoff_rejects_non_service_user(self):
        supplier = self.env["res.partner"].create(
            {"name": "Synthetic Denied Handoff Mill", "supplier_rank": 1}
        )
        product = self.env["product.product"].create({"name": "SYNTHETIC-DENIED"})
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.handoff"].with_user(
                self.unauthorized_user
            ).create_po_intent(
                supplier.id,
                [{"product_id": product.id, "product_qty": 1, "price_unit": 1.0}],
            )
