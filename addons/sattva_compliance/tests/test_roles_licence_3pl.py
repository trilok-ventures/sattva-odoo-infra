from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user


@tagged("post_install", "-at_install")
class TestPartnerGatesAndRoles(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.sales_user = new_test_user(
            cls.env,
            login="synthetic_sales_exec_pcp",
            groups="sattva_compliance.group_sales_exec,sales_team.group_sale_salesman",
        )
        cls.officer = new_test_user(
            cls.env,
            login="synthetic_officer_pcp",
            groups="sattva_compliance.group_compliance_officer,sales_team.group_sale_salesman",
        )

    def test_sales_cannot_edit_pcp_status(self):
        supplier = self.env["res.partner"].create(
            {"name": "Synthetic Sales PCP Mill", "supplier_rank": 1}
        )
        with self.assertRaises(AccessError):
            supplier.with_user(self.sales_user).write(
                {"supplier_pcp_status": "approved"}
            )

    def test_officer_can_edit_pcp_and_set_masked_licence(self):
        buyer = self.env["res.partner"].create(
            {"name": "Synthetic Officer Buyer", "customer_rank": 1}
        )
        buyer.with_user(self.officer).write(
            {
                "sfc_licence_status": "active",
                "sfc_licence_input": "SFC-ABC-9999",
            }
        )
        buyer.invalidate_recordset()
        self.assertEqual(buyer.sfc_licence_status, "active")
        self.assertEqual(buyer.sfc_licence_masked, "••••9999")
        self.assertTrue(buyer.sfc_licence_fingerprint)
        self.assertNotIn("SFC-ABC-9999", buyer.sfc_licence_fingerprint)
        self.assertFalse(buyer.sfc_licence_input)

    def test_kyc_complete_and_sfc_active_do_not_unlock_po(self):
        supplier = self.env["res.partner"].create(
            {
                "name": "Synthetic KYC Mill",
                "supplier_rank": 1,
                "buyer_kyc_status": "complete",
                "sfc_licence_status": "active",
                "supplier_pcp_status": "pending",
            }
        )
        product = self.env["product.product"].create({"name": "SYNTHETIC-KYC-ONION"})
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

    def test_supported_incoterms_rejects_unknown_token(self):
        partner = self.env["res.partner"].create(
            {"name": "Synthetic Bad Incoterm 3PL", "is_freight_forwarder": True}
        )
        with self.assertRaises(ValidationError):
            partner.write({"supported_incoterms": "FOB,EXW"})
