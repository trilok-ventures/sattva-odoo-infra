import re

from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestSaleGates(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_sale_gates",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.unauthorized = new_test_user(
            cls.env,
            login="synthetic_sale_gates_denied",
            groups="base.group_user",
        )
        cls.product = cls.env["product.product"].create(
            {"name": "SYNTHETIC-SALE-ONION", "sale_ok": True, "purchase_ok": True}
        )
        cls.buyer = cls.env["res.partner"].create(
            {
                "name": "Synthetic SFC Buyer",
                "customer_rank": 1,
                "buyer_sfc_status": "pending",
            }
        )
        cls.forwarder = cls.env["res.partner"].create(
            {
                "name": "Synthetic Forwarder",
                "is_logistics_partner": True,
                "supplier_rank": 0,
                "customer_rank": 0,
                "forwarder_status": "approved",
                "incoterm_fob": True,
                "incoterm_cif": True,
                "incoterm_dap": False,
            }
        )
        cls.supplier = cls.env["res.partner"].create(
            {
                "name": "Synthetic PCP Mill",
                "supplier_rank": 1,
                "supplier_pcp_status": "approved",
                "fssai_licence": "10012022000",
                "spices_board_rcm": "RCM-SYN",
            }
        )

    def _po_intent(self):
        return self.env["purchase.order"].create(
            {
                "partner_id": self.supplier.id,
                "order_line": [
                    (
                        0,
                        0,
                        {
                            "product_id": self.product.id,
                            "product_qty": 1,
                            "price_unit": 1.0,
                        },
                    )
                ],
            }
        )

    def _so(self, **vals):
        values = {
            "partner_id": self.buyer.id,
            "sattva_incoterm": "fob",
            "forwarder_id": self.forwarder.id,
            "purchase_intent_id": self._po_intent().id,
            "order_line": [
                (
                    0,
                    0,
                    {
                        "product_id": self.product.id,
                        "product_uom_qty": 1,
                        "price_unit": 1.0,
                    },
                )
            ],
        }
        values.update(vals)
        return self.env["sale.order"].create(values)

    def test_logistics_partner_does_not_queue_supplier_folder(self):
        events = self.env["sattva.fabric.event"].search(
            [("partner_id", "=", self.forwarder.id)]
        )
        self.assertFalse(events)

    def test_so_create_queues_order_folder(self):
        order = self._so()
        event = self.env["sattva.fabric.event"].search(
            [
                ("event_type", "=", "order_folder_requested"),
                ("sale_order_id", "=", order.id),
            ]
        )
        self.assertEqual(len(event), 1)
        token = re.sub(r"\W+", "_", order.name).strip("_")
        self.assertEqual(
            event.requested_path,
            f"/Clients/Synthetic_SFC_Buyer/Orders/{token}/",
        )

    def test_pending_sfc_blocks_confirm(self):
        order = self._so()
        with self.assertRaises(UserError) as err:
            order.action_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))
        self.assertIn("SFC", str(err.exception))
        self.assertEqual(order.state, "draft")

    def test_kyc_complete_does_not_unlock_so_or_po(self):
        self.buyer.buyer_kyc_status = "complete"
        self.buyer.buyer_sfc_status = "pending"
        order = self._so()
        with self.assertRaises(UserError):
            order.action_confirm()
        pending_supplier = self.env["res.partner"].create(
            {
                "name": "Synthetic KYC Mill",
                "supplier_rank": 1,
                "buyer_kyc_status": "complete",
                "buyer_sfc_status": "active",
                "supplier_pcp_status": "pending",
                "fssai_licence": "10012022999",
            }
        )
        po = self.env["purchase.order"].create(
            {
                "partner_id": pending_supplier.id,
                "order_line": [
                    (
                        0,
                        0,
                        {
                            "product_id": self.product.id,
                            "product_qty": 1,
                            "price_unit": 1.0,
                        },
                    )
                ],
            }
        )
        with self.assertRaises(UserError) as err:
            po.button_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))

    def test_unapproved_forwarder_blocks_confirm(self):
        self.buyer.buyer_sfc_status = "active"
        self.forwarder.forwarder_status = "pending"
        order = self._so()
        with self.assertRaises(UserError) as err:
            order.action_confirm()
        self.assertIn("Forwarder", str(err.exception))

    def test_unsupported_incoterm_blocks_confirm(self):
        self.buyer.buyer_sfc_status = "active"
        order = self._so(sattva_incoterm="dap")
        with self.assertRaises(UserError) as err:
            order.action_confirm()
        self.assertIn("DAP", str(err.exception))

    def test_first_so_requires_pcp_approved_intent(self):
        self.buyer.buyer_sfc_status = "active"
        self.supplier.supplier_pcp_status = "pending"
        order = self._so()
        with self.assertRaises(UserError) as err:
            order.action_confirm()
        self.assertIn("first SO", str(err.exception))

    def test_confirm_succeeds_then_second_skips_intent(self):
        self.buyer.buyer_sfc_status = "active"
        first = self._so()
        first.action_confirm()
        self.assertEqual(first.state, "sale")
        second = self._so(purchase_intent_id=False)
        second.action_confirm()
        self.assertEqual(second.state, "sale")

    def test_n8n_cannot_confirm_sale_order(self):
        self.buyer.buyer_sfc_status = "active"
        order = self._so()
        with self.assertRaises(AccessError):
            order.with_user(self.fabric_user).action_confirm()
        self.assertEqual(order.state, "draft")

    def test_set_order_path_writes_pointer(self):
        order = self._so()
        path = f"/Clients/Synthetic_SFC_Buyer/Orders/{order.name}/"
        self.env["sattva.fabric.vault"].with_user(self.fabric_user).set_order_path(
            order.id, path
        )
        self.assertEqual(order.nextcloud_order_folder_path, path)

    def test_set_order_path_rejects_non_service_user(self):
        order = self._so()
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.vault"].with_user(self.unauthorized).set_order_path(
                order.id, "/Clients/Synthetic_SFC_Buyer/Orders/X/"
            )

    def test_set_order_path_rejects_non_order_prefix(self):
        order = self._so()
        with self.assertRaises(UserError):
            self.env["sattva.fabric.vault"].set_order_path(
                order.id, "/Suppliers/Synthetic_SFC_Buyer/Certificates/"
            )
