from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user

SHA_A = "a" * 64
SHA_B = "b" * 64


@tagged("post_install", "-at_install")
class TestDossierIndex(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_dossier",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.unauthorized = new_test_user(
            cls.env,
            login="synthetic_dossier_denied",
            groups="base.group_user",
        )
        cls.officer = new_test_user(
            cls.env,
            login="synthetic_dossier_officer",
            groups="sattva_compliance.group_compliance_officer",
        )
        cls.buyer = cls.env["res.partner"].create(
            {"name": "Synthetic Dossier Buyer", "customer_rank": 1}
        )
        cls.supplier = cls.env["res.partner"].create(
            {"name": "Synthetic Dossier Mill", "supplier_rank": 1}
        )
        cls.order = cls.env["sale.order"].create({"partner_id": cls.buyer.id})
        cls.env["sattva.fabric.vault"].with_user(cls.fabric_user).set_order_path(
            cls.order.id,
            "/Clients/Synthetic_Dossier_Buyer/Orders/SO_DOSSIER/",
        )
        cls.lot = cls.env["sattva.brokerage.lot"].create(
            {"name": "SYN-DOS-001", "supplier_id": cls.supplier.id}
        )

    def _entry(self, **vals):
        values = {
            "filename": "coa.pdf",
            "sha256": SHA_A,
            "vault_href": "/Clients/Synthetic_Dossier_Buyer/Orders/SO_DOSSIER/coa.pdf",
        }
        values.update(vals)
        return values

    def _apply(self, entries=None, lot_id=None):
        return self.env["sattva.fabric.dossier"].with_user(
            self.fabric_user
        ).apply_index(
            self.order.id,
            lot_id if lot_id is not None else False,
            entries if entries is not None else [self._entry()],
        )

    def test_apply_index_writes_filename_and_hash(self):
        result = self._apply(lot_id=self.lot.id)
        entry = self.env["sattva.dossier.entry"].browse(result[0])
        self.assertTrue(entry.exists())
        self.assertEqual(entry.filename, "coa.pdf")
        self.assertEqual(entry.sha256, SHA_A)
        self.assertEqual(entry.sale_order_id, self.order)
        self.assertEqual(entry.lot_id, self.lot)
        self.assertEqual(entry.doc_kind, "coa")
        self.assertFalse(entry.message_ids.mapped("attachment_ids"))
        self.assertEqual(self.lot.state, "quarantine")
        self.assertEqual(self.order.state, "draft")

    def test_apply_index_is_idempotent_for_same_hash(self):
        first = self._apply()
        second = self._apply()
        self.assertEqual(first, second)
        self.assertEqual(
            self.env["sattva.dossier.entry"].search_count(
                [("sale_order_id", "=", self.order.id)]
            ),
            1,
        )

    def test_apply_index_updates_changed_hash(self):
        first_id = self._apply()[0]
        updated = self._apply(entries=[self._entry(sha256=SHA_B)])
        self.assertEqual(updated, [first_id])
        entry = self.env["sattva.dossier.entry"].browse(first_id)
        self.assertEqual(entry.sha256, SHA_B)

    def test_apply_index_rejects_non_service_user(self):
        with self.assertRaises(AccessError):
            self.env["sattva.fabric.dossier"].with_user(
                self.unauthorized
            ).apply_index(self.order.id, False, [self._entry()])

    def test_apply_index_rejects_path_filename_and_bytes(self):
        with self.assertRaises(UserError):
            self._apply(entries=[self._entry(filename="../coa.pdf")])
        with self.assertRaises(UserError):
            self._apply(entries=[self._entry(content="JVBERi0=")])
        with self.assertRaises(UserError):
            self._apply(entries=[self._entry(sha256="deadbeef")])
        with self.assertRaises(UserError):
            self._apply(
                entries=[
                    self._entry(
                        vault_href="/Suppliers/Mill/Certificates/coa.pdf",
                    )
                ]
            )

    def test_apply_index_rejects_direct_create(self):
        with self.assertRaises(AccessError):
            self.env["sattva.dossier.entry"].create(self._entry())

    def test_public_write_and_unlink_denied(self):
        entry_id = self._apply()[0]
        entry = self.env["sattva.dossier.entry"].browse(entry_id)
        with self.assertRaises(AccessError):
            entry.write({"filename": "other.pdf"})
        with self.assertRaises(AccessError):
            entry.unlink()

    def test_chatter_rejects_attachments(self):
        entry_id = self._apply()[0]
        entry = self.env["sattva.dossier.entry"].browse(entry_id)
        with self.assertRaises(UserError):
            entry.message_post(body="note", attachments=[("coa.pdf", b"%PDF")])

    def test_coa_hash_mismatch_opens_activity_without_release(self):
        self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            self.lot.id,
            "coa.pdf",
            SHA_A,
            5.0,
            True,
            6.0,
            True,
            True,
            True,
            1000.0,
            100000.0,
            0.0,
            False,
            0.0,
        )
        activities_before = self.env["mail.activity"].search_count(
            [
                ("res_model", "=", "sattva.brokerage.lot"),
                ("res_id", "=", self.lot.id),
            ]
        )
        self._apply(entries=[self._entry(sha256=SHA_B)], lot_id=self.lot.id)
        self.lot.invalidate_recordset()
        self.assertEqual(self.lot.state, "quarantine")
        self.assertEqual(self.lot.coa_sha256, SHA_A)
        self.assertGreater(
            self.env["mail.activity"].search_count(
                [
                    ("res_model", "=", "sattva.brokerage.lot"),
                    ("res_id", "=", self.lot.id),
                ]
            ),
            activities_before,
        )
