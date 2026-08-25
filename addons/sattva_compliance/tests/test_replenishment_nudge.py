from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user

from odoo.addons.sattva_compliance.models.notify import (
    ASSUMED_OCEAN_TRANSIT_DAYS,
    replenishment_summary,
)


@tagged("post_install", "-at_install")
class TestReplenishmentNudge(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_replenish",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.sales_user = new_test_user(
            cls.env,
            login="synthetic_human_sales_replenish",
            groups="sales_team.group_sale_salesman",
        )
        cls.unauthorized = new_test_user(
            cls.env,
            login="synthetic_replenish_denied",
            groups="base.group_user",
        )
        cls.product = cls.env["product.product"].create(
            {
                "name": "SYNTHETIC-REPLENISH-ONION",
                "sale_ok": True,
                "purchase_ok": True,
            }
        )
        cls.buyer = cls.env["res.partner"].create(
            {
                "name": "Synthetic Replenish Buyer",
                "customer_rank": 1,
                "buyer_sfc_status": "active",
            }
        )
        cls.forwarder = cls.env["res.partner"].create(
            {
                "name": "Synthetic Replenish Forwarder",
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
                "name": "Synthetic Replenish Mill",
                "supplier_rank": 1,
                "supplier_pcp_status": "approved",
                "fssai_licence": "10012022000",
                "spices_board_rcm": "RCM-SYN-R",
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

    def _confirm_aged(self, days, **vals):
        order = self._so(**vals)
        order.action_confirm()
        order.date_order = fields.Datetime.now() - timedelta(days=days)
        return order

    def _scan(self, partner_id=False):
        return (
            self.env["sattva.fabric.notify"]
            .with_user(self.fabric_user)
            .scan_replenishment_nudges(partner_id)
        )

    def test_due_so_opens_sales_activity_on_buyer(self):
        order = self._confirm_aged(ASSUMED_OCEAN_TRANSIT_DAYS + 5)
        created = self._scan()
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0]["partner_id"], self.buyer.id)
        self.assertEqual(created[0]["sale_order_id"], order.id)
        activity = self.env["mail.activity"].browse(created[0]["activity_id"])
        self.assertEqual(activity.res_model, "res.partner")
        self.assertEqual(activity.res_id, self.buyer.id)
        self.assertEqual(
            activity.summary, f"SATTVA: {replenishment_summary(order.name)}"
        )
        self.assertEqual(
            activity.date_deadline,
            fields.Date.to_date(order.date_order)
            + timedelta(days=ASSUMED_OCEAN_TRANSIT_DAYS),
        )
        self.assertTrue(
            activity.user_id.has_group("sales_team.group_sale_salesman")
        )
        self.assertFalse(
            activity.user_id.has_group(
                "sattva_compliance.group_n8n_fabric_service"
            )
        )
        self.assertEqual(self.buyer.sattva_replenishment_nudge_so_id, order)
        self.assertNotIn("@", activity.summary)
        self.assertNotIn("coa", activity.summary.lower())

    def test_scan_is_idempotent_for_the_same_so(self):
        self._confirm_aged(ASSUMED_OCEAN_TRANSIT_DAYS + 2)
        first = self._scan()
        second = self._scan()
        self.assertEqual(len(first), 1)
        self.assertEqual(second, [])
        activities = self.env["mail.activity"].search(
            [
                ("res_model", "=", "res.partner"),
                ("res_id", "=", self.buyer.id),
                ("summary", "ilike", "Replenishment nudge"),
            ]
        )
        self.assertEqual(len(activities), 1)

    def test_recent_so_does_not_nudge(self):
        self._confirm_aged(10)
        self.assertEqual(self._scan(), [])
        self.assertFalse(self.buyer.sattva_replenishment_nudge_so_id)

    def test_draft_so_is_ignored(self):
        order = self._so()
        order.date_order = fields.Datetime.now() - timedelta(days=60)
        self.assertEqual(order.state, "draft")
        self.assertEqual(self._scan(), [])

    def test_delivery_contact_nudges_commercial_buyer(self):
        dock = self.env["res.partner"].create(
            {
                "name": "Synthetic Replenish Dock",
                "parent_id": self.buyer.id,
                "type": "delivery",
            }
        )
        order = self._confirm_aged(
            ASSUMED_OCEAN_TRANSIT_DAYS + 1, partner_id=dock.id
        )
        created = self._scan(dock.id)
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0]["partner_id"], self.buyer.id)
        activity = self.env["mail.activity"].browse(created[0]["activity_id"])
        self.assertEqual(activity.res_id, self.buyer.id)
        self.assertEqual(created[0]["sale_order_id"], order.id)

    def test_newer_so_can_nudge_once_due(self):
        first = self._confirm_aged(ASSUMED_OCEAN_TRANSIT_DAYS + 20)
        self._scan()
        second = self._confirm_aged(ASSUMED_OCEAN_TRANSIT_DAYS + 1)
        created = self._scan()
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0]["sale_order_id"], second.id)
        self.assertEqual(self.buyer.sattva_replenishment_nudge_so_id, second)
        self.assertNotEqual(first.id, second.id)

    def test_scan_rejects_non_service_user(self):
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.notify"].with_user(
                self.unauthorized
            ).scan_replenishment_nudges()

    def test_nudge_pointer_is_scan_only(self):
        order = self._so()
        with self.assertRaises(AccessError):
            self.buyer.sattva_replenishment_nudge_so_id = order.id
        with self.assertRaises(AccessError):
            self.buyer.with_user(self.unauthorized).with_context(
                sattva_replenishment_scan=True
            ).write({"sattva_replenishment_nudge_so_id": order.id})

    def test_scan_does_not_confirm_or_write_stock(self):
        draft = self._so()
        quant_before = 0
        if "stock.quant" in self.env:
            quant_before = self.env["stock.quant"].sudo().search_count([])
        created = self._scan()
        self.assertEqual(created, [])
        self.assertEqual(draft.state, "draft")
        with self.assertRaises(AccessError):
            draft.with_user(self.fabric_user).action_confirm()
        if "stock.quant" in self.env:
            self.assertEqual(
                self.env["stock.quant"].sudo().search_count([]), quant_before
            )

    def test_create_partner_role_activity_uses_notify_helper(self):
        activity = (
            self.env["sattva.fabric.notify"]
            .with_user(self.fabric_user)
            .create_partner_role_activity(
                self.buyer.id,
                "Manual partner ping",
                "sales.exec",
            )
        )
        self.assertEqual(activity.res_model, "res.partner")
        self.assertEqual(activity.res_id, self.buyer.id)
        self.assertTrue(activity.summary.startswith("SATTVA:"))
        self.assertTrue(
            activity.user_id.has_group("sales_team.group_sale_salesman")
        )
        self.assertFalse(
            activity.user_id.has_group(
                "sattva_compliance.group_n8n_fabric_service"
            )
        )
