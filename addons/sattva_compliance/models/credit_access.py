from odoo.exceptions import UserError

NET60_DAYS = 60
MANUAL_SCORE_FIELDS = frozenset({"payment_score_financial", "payment_score_paydex"})
FINANCE_ONLY_FIELDS = MANUAL_SCORE_FIELDS | {"industry_sector"}
N8N_BLOCKED_PARTNER_FIELDS = FINANCE_ONLY_FIELDS | {"property_payment_term_id"}
CUSTOMER_MOVE_TYPES = frozenset({"out_invoice", "out_refund", "out_receipt"})


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


def _commercial_partners(env, vals, records, partner_attr):
    if records:
        return records.mapped(f"{partner_attr}.commercial_partner_id")
    partner_id = vals.get("partner_id")
    if not partner_id:
        return env["res.partner"]
    return env["res.partner"].browse(partner_id).commercial_partner_id


def deny_or_inherit_net60(env, term, commercial_partners):
    if not term or payment_term_max_days(term) < NET60_DAYS:
        return
    if is_n8n(env):
        raise UserError("n8n cannot write credit scores or payment terms.")
    if is_finance_manager(env):
        return
    if commercial_partners and all(
        partner.property_payment_term_id == term for partner in commercial_partners
    ):
        return
    raise UserError(
        "Finance manager must assign payment terms of 60 days or more."
    )


def check_partner_credit_vals(env, vals):
    if is_n8n(env) and N8N_BLOCKED_PARTNER_FIELDS.intersection(vals):
        raise UserError("n8n cannot write credit scores or payment terms.")
    if FINANCE_ONLY_FIELDS.intersection(vals) and (
        is_n8n(env) or not is_finance_manager(env)
    ):
        raise UserError(
            "Finance manager must set financial scores, Paydex, and industry sector."
        )
    if vals.get("property_payment_term_id"):
        deny_net60_term(
            env, env["account.payment.term"].browse(vals["property_payment_term_id"])
        )


def check_order_credit_vals(env, vals, orders=None):
    if is_n8n(env) and "payment_term_id" in vals:
        raise UserError("n8n cannot write credit scores or payment terms.")
    if not vals.get("payment_term_id"):
        return
    deny_or_inherit_net60(
        env,
        env["account.payment.term"].browse(vals["payment_term_id"]),
        _commercial_partners(env, vals, orders, "partner_id"),
    )


def check_move_credit_vals(env, vals, moves=None):
    if "invoice_payment_term_id" not in vals:
        return
    move_types = []
    if moves:
        move_types = list(moves.mapped("move_type"))
    elif vals.get("move_type"):
        move_types = [vals["move_type"]]
    if move_types and not any(kind in CUSTOMER_MOVE_TYPES for kind in move_types):
        return
    if not move_types:
        return
    if is_n8n(env) and "invoice_payment_term_id" in vals:
        raise UserError("n8n cannot write credit scores or payment terms.")
    term = env["account.payment.term"]
    if vals.get("invoice_payment_term_id"):
        term = env["account.payment.term"].browse(vals["invoice_payment_term_id"])
    deny_or_inherit_net60(
        env,
        term,
        _commercial_partners(env, vals, moves, "partner_id"),
    )
