from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestSupplierFolderRequest(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_fabric_service",
            groups="sattva_compliance.group_n8n_fabric_service",
        )

    def test_supplier_creation_queues_request_for_fabric_service_user(self):
        supplier = self.env["res.partner"].create(
            {
                "name": "Synthetic Spice Supplier",
                "supplier_rank": 1,
            }
        )

        event = self.env["sattva.fabric.event"].with_user(self.fabric_user).search(
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
        event.write({"state": "processed"})
        self.assertEqual(event.state, "processed")

    def test_non_supplier_creation_does_not_queue_folder_request(self):
        partner = self.env["res.partner"].create(
            {
                "name": "Synthetic Buyer",
                "supplier_rank": 0,
            }
        )

        event_count = (
            self.env["sattva.fabric.event"]
            .with_user(self.fabric_user)
            .search_count([("partner_id", "=", partner.id)])
        )

        self.assertEqual(event_count, 0)
