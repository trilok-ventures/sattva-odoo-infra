from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestSupplierFolderRequest(TransactionCase):
    def test_supplier_creation_queues_folder_request_and_keeps_pending_status(self):
        supplier = self.env["res.partner"].create(
            {
                "name": "Synthetic Spice Supplier",
                "supplier_rank": 1,
            }
        )

        event = self.env["sattva.fabric.event"].sudo().search(
            [
                ("event_type", "=", "supplier_folder_requested"),
                ("partner_id", "=", supplier.id),
            ]
        )

        self.assertEqual(len(event), 1)
        self.assertEqual(
            event.requested_path,
            "/Suppliers/Synthetic_Spice_Supplier/Certificates/",
        )
        self.assertEqual(event.state, "queued")
        self.assertEqual(supplier.supplier_pcp_status, "pending")

    def test_non_supplier_creation_does_not_queue_folder_request(self):
        partner = self.env["res.partner"].create(
            {
                "name": "Synthetic Buyer",
                "supplier_rank": 0,
            }
        )

        event_count = self.env["sattva.fabric.event"].sudo().search_count(
            [("partner_id", "=", partner.id)]
        )

        self.assertEqual(event_count, 0)
