from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestBuyerKyc(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_fabric_service_kyc",
            groups="sattva_compliance.group_n8n_fabric_service",
        )

    def test_customer_create_queues_onboarding_folder_and_pending_kyc(self):
        partner = self.env["res.partner"].create(
            {"name": "Synthetic Foods Inc", "customer_rank": 1}
        )
        event = self.env["sattva.fabric.event"].with_user(self.fabric_user).search(
            [
                ("event_type", "=", "buyer_folder_requested"),
                ("partner_id", "=", partner.id),
            ]
        )
        self.assertEqual(len(event), 1)
        self.assertEqual(
            event.requested_path,
            "/Clients/Synthetic_Foods_Inc/Onboarding/",
        )
        self.assertEqual(partner.buyer_kyc_status, "pending")
        self.assertEqual(partner.supplier_pcp_status, "pending")

    def test_buyer_kyc_complete_does_not_unlock_po(self):
        supplier = self.env["res.partner"].create(
            {
                "name": "Synthetic Mill",
                "supplier_rank": 1,
                "buyer_kyc_status": "complete",
                "supplier_pcp_status": "pending",
            }
        )
        product = self.env["product.product"].create({"name": "SYNTHETIC-ONION"})
        po = self.env["purchase.order"].create(
            {
                "partner_id": supplier.id,
                "order_line": [
                    (0, 0, {"product_id": product.id, "product_qty": 1, "price_unit": 1.0})
                ],
            }
        )
        with self.assertRaises(UserError) as err:
            po.button_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))

    def test_dual_role_keeps_two_vault_pointers(self):
        partner = self.env["res.partner"].create(
            {
                "name": "Synthetic Dual",
                "supplier_rank": 1,
                "customer_rank": 1,
            }
        )
        events = self.env["sattva.fabric.event"].search(
            [("partner_id", "=", partner.id)]
        )
        self.assertEqual(
            set(events.mapped("event_type")),
            {"supplier_folder_requested", "buyer_folder_requested"},
        )
        self.env["sattva.fabric.vault"].set_partner_path(
            partner.id, "/Suppliers/Synthetic_Dual/Certificates/", "supplier"
        )
        self.env["sattva.fabric.vault"].set_partner_path(
            partner.id, "/Clients/Synthetic_Dual/Onboarding/", "client"
        )
        self.assertEqual(
            partner.nextcloud_folder_path,
            "/Suppliers/Synthetic_Dual/Certificates/",
        )
        self.assertEqual(
            partner.nextcloud_client_folder_path,
            "/Clients/Synthetic_Dual/Onboarding/",
        )
