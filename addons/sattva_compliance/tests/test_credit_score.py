from odoo.tests import TransactionCase, tagged
from odoo.tests.common import new_test_user
from datetime import date

from odoo.exceptions import AccessError, UserError, ValidationError

from odoo.addons.sattva_compliance.models.credit_formula import (
    composite_score,
    credit_tier,
    invoice_dbt_days,
    score_market,
    score_punctuality,
    score_volume,
)


@tagged("post_install", "-at_install")
class TestCreditFormula(TransactionCase):
    def test_unknown_components_default_fifty(self):
        self.assertEqual(score_punctuality(0, 99), 50)
        self.assertEqual(score_volume(0), 50)
        self.assertEqual(score_market(False), 50)
        self.assertEqual(score_market("other"), 50)

    def test_volume_and_market_buckets(self):
        self.assertEqual(score_volume(3), 60)
        self.assertEqual(score_volume(10), 100)
        self.assertEqual(score_market("food_service"), 80)
        self.assertEqual(score_market("retail"), 70)
        self.assertEqual(score_market("manufacturing"), 60)

    def test_punctuality_dbt_buckets(self):
        self.assertEqual(score_punctuality(1, 0), 100)
        self.assertEqual(score_punctuality(1, 15), 80)
        self.assertEqual(score_punctuality(1, 30), 60)
        self.assertEqual(score_punctuality(1, 60), 40)
        self.assertEqual(score_punctuality(1, 61), 20)

    def test_paid_invoice_is_current(self):
        self.assertEqual(invoice_dbt_days("paid", date(2020, 1, 1), date(2026, 8, 24)), 0)

    def test_composite_and_tiers(self):
        self.assertEqual(composite_score(50, 50, 50, 50, 50), 50)
        self.assertEqual(credit_tier(50), "3")
        self.assertEqual(composite_score(50, 50, 50, 0, 0), 30)
        self.assertEqual(credit_tier(30), "4")
        self.assertEqual(credit_tier(80), "1")
        self.assertEqual(credit_tier(65), "2")
        self.assertEqual(credit_tier(49), "4")


@tagged("post_install", "-at_install")
class TestCreditScore(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.fabric_user = new_test_user(
            cls.env,
            login="synthetic_n8n_credit",
            groups="sattva_compliance.group_n8n_fabric_service",
        )
        cls.sales = new_test_user(
            cls.env,
            login="synthetic_credit_sales",
            groups="sales_team.group_sale_salesman,sales_team.group_sale_manager",
        )
        cls.n8n_sales = new_test_user(
            cls.env,
            login="synthetic_n8n_credit_sales",
            groups="sattva_compliance.group_n8n_fabric_service,sales_team.group_sale_manager",
        )
        cls.accountant = new_test_user(
            cls.env,
            login="synthetic_credit_account_user",
            groups="account.group_account_user,sales_team.group_sale_manager",
        )
        cls.finance = new_test_user(
            cls.env,
            login="synthetic_credit_finance",
            groups="account.group_account_manager,sales_team.group_sale_salesman,sales_team.group_sale_manager",
        )
        cls.product = cls.env["product.product"].create(
            {"name": "SYNTHETIC-CREDIT-ONION", "sale_ok": True, "purchase_ok": True}
        )
        cls.buyer = cls.env["res.partner"].create(
            {
                "name": "Synthetic Credit Buyer",
                "customer_rank": 1,
                "buyer_sfc_status": "active",
            }
        )
        cls.forwarder = cls.env["res.partner"].create(
            {
                "name": "Synthetic Credit Forwarder",
                "is_logistics_partner": True,
                "supplier_rank": 0,
                "forwarder_status": "approved",
                "incoterm_fob": True,
                "incoterm_cif": True,
                "incoterm_dap": True,
            }
        )
        cls.supplier = cls.env["res.partner"].create(
            {
                "name": "Synthetic Credit Mill",
                "supplier_rank": 1,
                "supplier_pcp_status": "approved",
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

    def _term(self, days, name):
        return self.env["account.payment.term"].create(
            {
                "name": name,
                "line_ids": [
                    (
                        0,
                        0,
                        {
                            "value": "percent",
                            "value_amount": 100,
                            "nb_days": days,
                            "delay_type": "days_after",
                        },
                    )
                ],
            }
        )

    def test_new_buyer_defaults_to_tier_three(self):
        self.assertEqual(self.buyer.payment_score_punctuality, 50)
        self.assertEqual(self.buyer.payment_score_volume, 50)
        self.assertEqual(self.buyer.payment_score_market, 50)
        self.assertEqual(self.buyer.payment_score_financial, 50)
        self.assertEqual(self.buyer.payment_score_paydex, 50)
        self.assertEqual(self.buyer.payment_score_total, 50)
        self.assertEqual(self.buyer.credit_risk_tier, "3")

    def test_industry_maps_market_score(self):
        self.buyer.industry_sector = "food_service"
        self.assertEqual(self.buyer.payment_score_market, 80)

    def test_confirmed_fcl_raises_volume(self):
        order = self._so(fcl_count=3)
        order.action_confirm()
        self.buyer.invalidate_recordset()
        self.assertEqual(self.buyer.payment_score_volume, 60)

    def test_tier_four_blocks_cif_allows_fob(self):
        self.buyer.payment_score_financial = 0
        self.buyer.payment_score_paydex = 0
        self.assertEqual(self.buyer.credit_risk_tier, "4")
        cif = self._so(sattva_incoterm="cif")
        with self.assertRaises(UserError) as err:
            cif.action_confirm()
        self.assertIn("Compliance Gate Blocked", str(err.exception))
        self.assertIn("tier 4", str(err.exception).lower())
        self.assertEqual(cif.state, "draft")
        fob = self._so(sattva_incoterm="fob")
        fob.action_confirm()
        self.assertEqual(fob.state, "sale")

    def test_sales_cannot_write_manual_scores(self):
        with self.assertRaises(UserError):
            self.buyer.with_user(self.sales).write({"payment_score_financial": 90})
        with self.assertRaises(UserError):
            self.buyer.with_user(self.sales).write({"payment_score_paydex": 10})
        self.assertEqual(self.buyer.payment_score_financial, 50)

    def test_finance_can_write_manual_scores_and_snapshot(self):
        self.buyer.with_user(self.finance).write({"payment_score_financial": 80})
        self.assertEqual(self.buyer.payment_score_financial, 80)
        log = self.env["sattva.payment.score"].search(
            [("partner_id", "=", self.buyer.id)]
        )
        self.assertTrue(log)
        self.assertEqual(log[0].score_f, 80)

    def test_sales_cannot_self_serve_net_60(self):
        net60 = self._term(60, "SYN Net 60")
        net30 = self._term(30, "SYN Net 30")
        with self.assertRaises(UserError) as err:
            self.buyer.with_user(self.sales).write(
                {"property_payment_term_id": net60.id}
            )
        self.assertIn("60", str(err.exception))
        self.buyer.with_user(self.sales).write({"property_payment_term_id": net30.id})
        self.assertEqual(self.buyer.property_payment_term_id, net30)
        order = self._so()
        with self.assertRaises(UserError):
            order.with_user(self.sales).write({"payment_term_id": net60.id})
        order.with_user(self.finance).write({"payment_term_id": net60.id})
        self.assertEqual(order.payment_term_id, net60)
        self.buyer.with_user(self.finance).write(
            {"property_payment_term_id": net60.id}
        )
        self.assertEqual(self.buyer.property_payment_term_id, net60)
        order.with_user(self.sales).write({"payment_term_id": net60.id})
        self.assertEqual(order.payment_term_id, net60)

    def test_account_user_cannot_write_scores_or_net_60(self):
        net60 = self._term(60, "SYN accountant Net 60")
        with self.assertRaises(UserError):
            self.buyer.with_user(self.accountant).write(
                {"payment_score_financial": 90}
            )
        with self.assertRaises(UserError):
            self.buyer.with_user(self.accountant).write(
                {"industry_sector": "food_service"}
            )
        with self.assertRaises(UserError):
            self.buyer.with_user(self.accountant).write(
                {"property_payment_term_id": net60.id}
            )

    def test_sales_cannot_write_industry_sector(self):
        with self.assertRaises(UserError):
            self.buyer.with_user(self.sales).write(
                {"industry_sector": "food_service"}
            )
        self.assertFalse(self.buyer.industry_sector)

    def test_child_score_write_updates_commercial(self):
        dock = self.env["res.partner"].create(
            {
                "name": "Synthetic Credit Dock",
                "parent_id": self.buyer.id,
                "type": "delivery",
            }
        )
        dock.with_user(self.finance).write(
            {"payment_score_financial": 0, "payment_score_paydex": 0}
        )
        self.assertEqual(self.buyer.payment_score_financial, 0)
        self.assertEqual(self.buyer.credit_risk_tier, "4")
        self.assertEqual(dock.credit_risk_tier, "4")
        cif = self._so(partner_id=dock.id, sattva_incoterm="cif")
        with self.assertRaises(UserError) as err:
            cif.action_confirm()
        self.assertIn("tier 4", str(err.exception).lower())

    def test_sales_cannot_change_confirmed_fcl(self):
        order = self._so(fcl_count=1)
        order.action_confirm()
        with self.assertRaises(UserError):
            order.with_user(self.sales).write({"fcl_count": 9})
        order.with_user(self.finance).write({"fcl_count": 4})
        self.assertEqual(order.fcl_count, 4)

    def test_dual_group_n8n_cannot_confirm(self):
        order = self._so()
        with self.assertRaises(AccessError):
            order.with_user(self.n8n_sales).action_confirm()
        self.assertEqual(order.state, "draft")

    def test_score_log_is_read_only(self):
        self.buyer.action_recompute_payment_score()
        row = self.env["sattva.payment.score"].search(
            [("partner_id", "=", self.buyer.id)], limit=1
        )
        with self.assertRaises(AccessError):
            row.write({"score_total": 99})
        with self.assertRaises(AccessError):
            self.env["sattva.payment.score"].create(
                {
                    "partner_id": self.buyer.id,
                    "score_p": 100,
                    "score_v": 100,
                    "score_m": 100,
                    "score_f": 100,
                    "score_r": 100,
                    "score_total": 100,
                    "credit_risk_tier": "1",
                }
            )

    def test_sales_cannot_self_serve_net_60_on_invoice(self):
        net60 = self._term(60, "SYN invoice Net 60")
        move = self.env["account.move"].create(
            {
                "move_type": "out_invoice",
                "partner_id": self.buyer.id,
            }
        )
        with self.assertRaises(UserError):
            move.with_user(self.accountant).write(
                {"invoice_payment_term_id": net60.id}
            )
        self.buyer.with_user(self.finance).write(
            {"property_payment_term_id": net60.id}
        )
        move.with_user(self.accountant).write(
            {"invoice_payment_term_id": net60.id}
        )
        self.assertEqual(move.invoice_payment_term_id, net60)

    def test_n8n_cannot_write_industry(self):
        with self.assertRaises(UserError):
            self.buyer.with_user(self.fabric_user).write(
                {"industry_sector": "retail"}
            )

    def test_n8n_cannot_write_scores_or_terms_or_recompute(self):
        net60 = self._term(60, "SYN n8n Net 60")
        with self.assertRaises(UserError):
            self.buyer.with_user(self.fabric_user).write(
                {"payment_score_paydex": 99}
            )
        with self.assertRaises(UserError):
            self.buyer.with_user(self.fabric_user).write(
                {"property_payment_term_id": net60.id}
            )
        with self.assertRaises(AccessError):
            self.buyer.with_user(self.fabric_user).action_recompute_payment_score()
        with self.assertRaises(AccessError):
            self.env["sattva.payment.score"].with_user(self.fabric_user).create(
                {
                    "partner_id": self.buyer.id,
                    "score_p": 100,
                    "score_v": 100,
                    "score_m": 100,
                    "score_f": 100,
                    "score_r": 100,
                    "score_total": 100,
                    "credit_risk_tier": "1",
                }
            )

    def test_n8n_can_read_score_log(self):
        self.buyer.action_recompute_payment_score()
        rows = (
            self.env["sattva.payment.score"]
            .with_user(self.fabric_user)
            .search([("partner_id", "=", self.buyer.id)])
        )
        self.assertTrue(rows)
        self.assertEqual(rows[0].score_total, 50)

    def test_n8n_cannot_confirm_tier4_cif(self):
        self.buyer.payment_score_financial = 0
        self.buyer.payment_score_paydex = 0
        order = self._so(sattva_incoterm="cif")
        with self.assertRaises(AccessError):
            order.with_user(self.fabric_user).action_confirm()
        self.assertEqual(order.state, "draft")

    def test_fcl_count_cannot_be_negative(self):
        with self.assertRaises(ValidationError):
            self._so(fcl_count=-1)

    def test_manual_scores_are_clamped(self):
        with self.assertRaises(ValidationError):
            self.buyer.payment_score_financial = 101
        with self.assertRaises(ValidationError):
            self.buyer.payment_score_paydex = -1
