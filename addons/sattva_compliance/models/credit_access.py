from odoo.exceptions import UserError

NET60_DAYS = 60
MANUAL_SCORE_FIELDS = frozenset({"payment_score_financial", "payment_score_paydex"})
N8N_BLOCKED_PARTNER_FIELDS = MANUAL_SCORE_FIELDS | {
    "industry_sector",
    "property_payment_term_id",
}


def is_n8n(env):
    return env.user.has_group("sattva_compliance.group_n8n_fabric_service")


def is_finance_manager(env):
    if is_n8n(env):
        return False
    return env.su or env.user.has_group("account.group_account_manager")


def payment_term_max_days(term):
    if not term:
        return 0
    return max((line.nb_days for line in term.line_ids), default=0)


def deny_net60_term(env, term):
    if not term or payment_term_max_days(term) < NET60_DAYS:
        return
    if is_n8n(env) or not is_finance_manager(env):
        raise UserError(
            "Finance manager must assign payment terms of 60 days or more."
        )


def check_partner_credit_vals(env, vals):
    if is_n8n(env) and N8N_BLOCKED_PARTNER_FIELDS.intersection(vals):
        raise UserError("n8n cannot write credit scores or payment terms.")
    if MANUAL_SCORE_FIELDS.intersection(vals) and (
        is_n8n(env) or not is_finance_manager(env)
    ):
        raise UserError("Finance manager must set financial and Paydex scores.")
    if vals.get("property_payment_term_id"):
        deny_net60_term(
            env, env["account.payment.term"].browse(vals["property_payment_term_id"])
        )


def check_order_credit_vals(env, vals):
    if is_n8n(env) and "payment_term_id" in vals:
        raise UserError("n8n cannot write credit scores or payment terms.")
    if vals.get("payment_term_id"):
        deny_net60_term(
            env, env["account.payment.term"].browse(vals["payment_term_id"])
        )
