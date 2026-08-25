from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user

SHA = "c" * 64
SHA_Q = "d" * 64


@tagged("post_install", "-at_install")
class TestPortalListLots(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_portal",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.bff = new_test_user(
            cls.env,
            login="synthetic_bff_portal",
            groups="base.group_user,sattva_compliance.group_middleware_bff",
        )
        cls.unauthorized = new_test_user(
            cls.env,
            login="synthetic_portal_denied",
            groups="base.group_user",
        )
        cls.officer = new_test_user(
            cls.env,
            login="synthetic_portal_officer",
            groups="sattva_compliance.group_compliance_officer",
        )
        cls.share = new_test_user(
            cls.env,
            login="synthetic_portal_share",
            groups="base.group_portal",
        )
        cls.n8n_and_bff = new_test_user(
            cls.env,
            login="synthetic_n8n_bff",
            groups="sattva_compliance.group_n8n_fabric_service,sattva_compliance.group_middleware_bff",
        )
        cls.buyer = cls.env["res.partner"].create(
            {"name": "Synthetic Portal Buyer", "customer_rank": 1}
        )
        cls.other_buyer = cls.env["res.partner"].create(
            {"name": "Synthetic Other Buyer", "customer_rank": 1}
        )
        cls.supplier = cls.env["res.partner"].create(
            {"name": "Synthetic Portal Mill", "supplier_rank": 1}
        )
        cls.order = cls.env["sale.order"].create({"partner_id": cls.buyer.id})
        cls.other_order = cls.env["sale.order"].create(
            {"partner_id": cls.other_buyer.id}
        )
        cls.env["sattva.fabric.vault"].with_user(cls.fabric_user).set_order_path(
            cls.order.id,
            "/Clients/Synthetic_Portal_Buyer/Orders/SO_PORTAL/",
        )
        cls.env["sattva.fabric.vault"].with_user(cls.fabric_user).set_order_path(
            cls.other_order.id,
            "/Clients/Synthetic_Other_Buyer/Orders/SO_OTHER/",
        )
        cls.released = cls.env["sattva.brokerage.lot"].create(
            {"name": "PORTAL-REL-001", "supplier_id": cls.supplier.id}
        )
        cls.quarantine = cls.env["sattva.brokerage.lot"].create(
            {"name": "PORTAL-Q-001", "supplier_id": cls.supplier.id}
        )
        cls.unlinked = cls.env["sattva.brokerage.lot"].create(
            {"name": "PORTAL-UNLINKED", "supplier_id": cls.supplier.id}
        )

    def _apply_coa(self, lot, sha, moisture=5.0):
        return self.env["sattva.fabric.lot"].with_user(self.fabric_user).apply_coa_green(
            lot.id,
            "coa.pdf",
            sha,
            moisture,
            True,
            6.0,
            True,
            True,
            True,
            1000.0,
            100000.0,
            42.0,
            True,
            20.0,
        )

    def _index(self, order, lot):
        return self.env["sattva.fabric.dossier"].with_user(self.fabric_user).apply_index(
            order.id,
            lot.id,
            [
                {
                    "filename": "coa.pdf",
                    "sha256": SHA,
                    "vault_href": "%scoa.pdf" % (order.nextcloud_order_folder_path,),
                }
            ],
        )

    def _list(self, user, buyer_partner_id=False):
        return (
            self.env["sattva.fabric.portal"]
            .with_user(user)
            .list_lots(buyer_partner_id)
        )

    def test_n8n_cannot_list_lots(self):
        with self.assertRaises(AccessError):
            self._list(self.fabric_user)

    def test_share_user_cannot_list_lots(self):
        with self.assertRaises(AccessError):
            self._list(self.share)

    def test_internal_user_without_bff_group_cannot_list_lots(self):
        with self.assertRaises(AccessError):
            self._list(self.unauthorized)

    def test_employee_sees_all_lots_green_only(self):
        self._apply_coa(self.released, SHA)
        self._apply_coa(self.quarantine, SHA_Q)
        self.released.with_user(self.officer).action_release()
        self._index(self.order, self.released)
        self._index(self.order, self.quarantine)
        rows = {row["id"]: row for row in self._list(self.bff)}
        self.assertIn("PORTAL-REL-001", rows)
        self.assertIn("PORTAL-Q-001", rows)
        self.assertIn("PORTAL-UNLINKED", rows)
        released = rows["PORTAL-REL-001"]
        quarantined = rows["PORTAL-Q-001"]
        self.assertEqual(released["state"], "available")
        self.assertTrue(released["coa_pass"])
        self.assertEqual(released["coa_sha256"], SHA)
        self.assertEqual(released["buyer_order"], self.order.name)
        self.assertNotIn("officer_released", released)
        self.assertNotIn("vault_href", released)
        self.assertNotIn("supplier_id", released)
        self.assertNotIn("coa_filename", released)
        self.assertEqual(quarantined["state"], "quarantine")
        self.assertTrue(quarantined["coa_pass"])
        unlinked = rows["PORTAL-UNLINKED"]
        self.assertFalse(unlinked["buyer_order"])
        self.assertFalse(unlinked["coa_pass"])

    def test_buyer_sees_only_own_dossier_lots(self):
        self._apply_coa(self.released, SHA)
        self._apply_coa(self.quarantine, SHA_Q)
        self._index(self.order, self.released)
        self._index(self.other_order, self.quarantine)
        mine = self._list(self.bff, self.buyer.id)
        self.assertEqual([row["id"] for row in mine], ["PORTAL-REL-001"])
        self.assertEqual(mine[0]["buyer_order"], self.order.name)
        other = self._list(self.bff, self.other_buyer.id)
        self.assertEqual([row["id"] for row in other], ["PORTAL-Q-001"])
        empty = self._list(self.bff, self.supplier.id)
        self.assertEqual(empty, [])

    def test_unknown_buyer_raises(self):
        with self.assertRaises(UserError):
            self._list(self.bff, 10**9)

    def test_list_lots_does_not_release(self):
        self._apply_coa(self.quarantine, SHA_Q)
        self._index(self.order, self.quarantine)
        self._list(self.bff)
        self.quarantine.invalidate_recordset()
        self.assertEqual(self.quarantine.state, "quarantine")
