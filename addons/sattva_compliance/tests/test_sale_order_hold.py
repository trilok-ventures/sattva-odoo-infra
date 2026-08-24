from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestSaleOrderFirstOrderHold(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.officer = new_test_user(
            cls.env,
            login="synthetic_officer_so_hold",
            groups=(
                "sattva_compliance.group_compliance_officer,"
                "sales_team.group_sale_salesman"
            ),
        )
        cls.sales_user = new_test_user(
            cls.env,
            login="synthetic_sales_so_hold",
            groups="sattva_compliance.group_sales_exec,sales_team.group_sale_salesman",
        )
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_salehold",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.buyer = cls.env["res.partner"].create(
            {
                "name": "Synthetic First Order Buyer",
                "customer_rank": 1,
                "sfc_licence_status": "pending",
            }
        )
        cls.supplier = cls.env["res.partner"].create(
            {
                "name": "Synthetic Hold Mill",
                "supplier_rank": 1,
                "supplier_pcp_status": "pending",
            }
        )
        cls.forwarder = cls.env["res.partner"].create(
            {
                "name": "Synthetic Hold 3PL",
                "is_freight_forwarder": True,
                "forwarder_status": "pending",
                "cfia_swi_capable": True,
                "insurance_meets_min": True,
                "supported_incoterms": "FOB,CIF",
            }
        )
        cls.product = cls.env["product.product"].create(
            {"name": "SYNTHETIC-SO-ONION", "sale_ok": True, "list_price": 10.0}
        )

    def _make_so(self, **extra):
        vals = {
            "partner_id": self.buyer.id,
            "sattva_supplier_id": self.supplier.id,
            "sattva_forwarder_id": self.forwarder.id,
            "sattva_incoterm": "FOB",
            "order_line": [
                (0, 0, {"product_id": self.product.id, "product_uom_qty": 1})
            ],
        }
        vals.update(extra)
        return self.env["sale.order"].create(vals)

    def test_first_order_hold_blocks_confirm(self):
        order = self._make_so()
        self.assertTrue(order.sattva_first_order)
        self.assertTrue(order.sattva_compliance_hold)
        with self.assertRaises(UserError) as err:
            order.action_confirm()
        self.assertIn("Compliance Hold", str(err.exception))
        self.assertNotEqual(order.state, "sale")

    def test_sales_cannot_release_hold(self):
        order = self._make_so()
        with self.assertRaises(AccessError):
            order.with_user(self.sales_user).action_release_first_order_hold()

    def test_officer_release_allows_confirm_without_auto_confirm(self):
        order = self._make_so()
        order.with_user(self.officer).action_release_first_order_hold()
        self.assertFalse(order.sattva_compliance_hold)
        self.assertTrue(order.sattva_hold_released)
        self.assertEqual(order.state, "draft")
        order.with_user(self.officer).action_confirm()
        self.assertIn(order.state, ("sale", "done"))

    def test_approved_path_skips_hold(self):
        self.supplier.supplier_pcp_status = "approved"
        self.forwarder.forwarder_status = "approved"
        self.buyer.sfc_licence_status = "active"
        order = self._make_so()
        self.assertFalse(order.sattva_compliance_hold)
        order.action_confirm()
        self.assertIn(order.state, ("sale", "done"))

    def test_n8n_set_hold_never_confirms(self):
        self.supplier.supplier_pcp_status = "approved"
        self.forwarder.forwarder_status = "approved"
        self.buyer.sfc_licence_status = "active"
        order = self._make_so()
        self.assertFalse(order.sattva_compliance_hold)
        self.env["sattva.fabric.salehold"].with_user(self.fabric_user).set_hold(
            order.id, "manual 3PL document lag"
        )
        order.invalidate_recordset()
        self.assertTrue(order.sattva_compliance_hold)
        self.assertEqual(order.state, "draft")
        with self.assertRaises(UserError):
            order.action_confirm()

    def test_po_firewall_still_blocks_pending_supplier(self):
        product = self.env["product.product"].create({"name": "SYNTHETIC-PO-HOLD"})
        po = self.env["purchase.order"].create(
            {
                "partner_id": self.supplier.id,
                "order_line": [
                    (0, 0, {"product_id": product.id, "product_qty": 1, "price_unit": 1.0})
                ],
            }
        )
        with self.assertRaises(UserError) as err:
            po.button_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))
