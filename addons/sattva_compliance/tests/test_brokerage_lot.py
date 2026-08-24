from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user

SHA = "a" * 64


@tagged("post_install", "-at_install")
class TestBrokerageLot(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_lot",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.officer = new_test_user(
            cls.env,
            login="synthetic_lot_officer",
            groups="sattva_compliance.group_compliance_officer",
        )
        cls.sales = new_test_user(
            cls.env,
            login="synthetic_lot_sales",
            groups="sales_team.group_sale_salesman",
        )
        cls.unauthorized = new_test_user(
            cls.env,
            login="synthetic_lot_denied",
            groups="base.group_user",
        )
        cls.supplier = cls.env["res.partner"].create(
            {"name": "Synthetic Lot Mill", "supplier_rank": 1}
        )

    def _lot(self):
        return self.env["sattva.brokerage.lot"].create(
            {
                "name": "SYN-LOT-001",
                "supplier_id": self.supplier.id,
            }
        )

    def test_new_lot_defaults_to_quarantine(self):
        lot = self._lot()
        self.assertEqual(lot.state, "quarantine")
        self.assertFalse(lot.coa_pass)
        self.assertFalse(lot.coa_sha256)

    def test_apply_coa_green_pass_stays_quarantine(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 5.5, True, 6.0, True
        )
        lot.invalidate_recordset()
        self.assertTrue(lot.coa_pass)
        self.assertEqual(lot.coa_sha256, SHA)
        self.assertEqual(lot.coa_filename, "coa.pdf")
        self.assertEqual(lot.moisture_pct, 5.5)
        self.assertTrue(lot.mesh_pass)
        self.assertEqual(lot.state, "quarantine")

    def test_apply_coa_green_fail_opens_capa_and_stays_quarantine(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 9.0, False, 6.0, True
        )
        lot.invalidate_recordset()
        self.assertFalse(lot.coa_pass)
        self.assertEqual(lot.state, "quarantine")
        activities = self.env["mail.activity"].search(
            [
                ("res_model", "=", "sattva.brokerage.lot"),
                ("res_id", "=", lot.id),
            ]
        )
        self.assertTrue(activities)
        self.assertTrue(activities[0].summary.startswith("SATTVA:"))
        self.assertTrue(
            activities[0].user_id.has_group(
                "sattva_compliance.group_compliance_officer"
            )
        )
        self.assertFalse(
            activities[0].user_id.has_group(
                "sattva_compliance.group_n8n_fabric_service"
            )
        )

    def test_apply_coa_green_rejects_non_service_user(self):
        lot = self._lot()
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.lot"].with_user(self.unauthorized).apply_coa_green(
                lot.id, "coa.pdf", SHA, 5.0, True, 6.0, True
            )

    def test_apply_coa_green_rejects_path_filename(self):
        lot = self._lot()
        with self.assertRaises(UserError):
            self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
                lot.id, "/Clients/x/coa.pdf", SHA, 5.0, True, 6.0, True
            )

    def test_n8n_cannot_release_lot(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 5.0, True, 6.0, True
        )
        with self.assertRaises(AccessError):
            lot.with_user(self.fabric_user).action_release()
        self.assertEqual(lot.state, "quarantine")

    def test_officer_releases_only_when_coa_pass(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 5.0, True, 6.0, True
        )
        lot.with_user(self.officer).action_release()
        self.assertEqual(lot.state, "available")

    def test_officer_cannot_release_failed_coa(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 9.0, True, 6.0, True
        )
        with self.assertRaises(UserError):
            lot.with_user(self.officer).action_release()
        self.assertEqual(lot.state, "quarantine")

    def test_sales_cannot_release(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 5.0, True, 6.0, True
        )
        with self.assertRaises(AccessError):
            lot.with_user(self.sales).action_release()

    def test_create_cannot_start_available_or_set_green(self):
        lot = self.env["sattva.brokerage.lot"].with_user(self.officer).create(
            {
                "name": "SYN-LOT-FORCE",
                "supplier_id": self.supplier.id,
                "state": "available",
                "coa_pass": True,
                "coa_sha256": SHA,
            }
        )
        self.assertEqual(lot.state, "quarantine")
        self.assertFalse(lot.coa_pass)
        self.assertFalse(lot.coa_sha256)

    def test_officer_write_cannot_mark_available(self):
        lot = self._lot()
        with self.assertRaises(UserError):
            lot.with_user(self.officer).write({"state": "available"})
        self.assertEqual(lot.state, "quarantine")

    def test_officer_write_cannot_set_coa_pass(self):
        lot = self._lot()
        with self.assertRaises(AccessError):
            lot.with_user(self.officer).write({"coa_pass": True, "coa_sha256": SHA})

    def test_n8n_write_cannot_mark_available(self):
        lot = self._lot()
        with self.assertRaises(AccessError):
            lot.with_user(self.fabric_user).write({"state": "available"})

    def test_dual_grouped_n8n_officer_cannot_release(self):
        dual = new_test_user(
            self.env,
            login="synthetic_lot_dual",
            groups="sattva_compliance.group_n8n_fabric_service,sattva_compliance.group_compliance_officer",
        )
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 5.0, True, 6.0, True
        )
        with self.assertRaises(AccessError):
            lot.with_user(dual).action_release()
        self.assertEqual(lot.state, "quarantine")

    def test_mesh_not_required_passes_without_mesh(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 5.0, False, 6.0, False
        )
        lot.invalidate_recordset()
        self.assertTrue(lot.coa_pass)
        self.assertEqual(lot.state, "quarantine")

    def test_backslash_filename_rejected(self):
        lot = self._lot()
        with self.assertRaises(UserError):
            self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
                lot.id, "folder\\coa.pdf", SHA, 5.0, True, 6.0, True
            )

    def test_chatter_rejects_attachments(self):
        lot = self._lot()
        with self.assertRaises(UserError):
            lot.message_post(body="note", attachments=[("coa.pdf", b"%PDF")])

    def test_officer_reject_then_cannot_release(self):
        lot = self._lot()
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id, "coa.pdf", SHA, 5.0, True, 6.0, True
        )
        lot.with_user(self.officer).action_reject()
        self.assertEqual(lot.state, "rejected")
        with self.assertRaises(UserError):
            lot.with_user(self.officer).action_release()
