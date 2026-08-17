from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestOrderHandoff(TransactionCase):
    def test_handoff_creates_draft_and_does_not_confirm_pending_supplier(self):
        supplier = self.env["res.partner"].create(
            {"name": "Synthetic Handoff Mill", "supplier_rank": 1}
        )
        product = self.env["product.product"].create({"name": "SYNTHETIC-GARLIC"})
        po = self.env["sattva.fabric.handoff"].create_po_intent(
            supplier.id,
            [{"product_id": product.id, "product_qty": 1, "price_unit": 1.0}],
        )
        self.assertEqual(po.state, "draft")
        with self.assertRaises(UserError) as err:
            po.button_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))
