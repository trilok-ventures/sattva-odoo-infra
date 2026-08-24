MARKET_SCORES = {
    "food_service": 80,
    "retail": 70,
    "manufacturing": 60,
    "other": 50,
}


def score_punctuality(invoice_count, avg_dbt_days):
    if not invoice_count:
        return 50
    if avg_dbt_days <= 0:
        return 100
    if avg_dbt_days <= 15:
        return 80
    if avg_dbt_days <= 30:
        return 60
    if avg_dbt_days <= 60:
        return 40
    return 20


def score_volume(fcl_sum):
    if not fcl_sum:
        return 50
    return min(100, 20 * int(fcl_sum))


def score_market(industry_sector):
    return MARKET_SCORES.get(industry_sector or "other", 50)


def composite_score(punctuality, volume, market, financial, paydex):
    return int(round(0.2 * (punctuality + volume + market + financial + paydex)))


def credit_tier(total):
    if total >= 80:
        return "1"
    if total >= 65:
        return "2"
    if total >= 50:
        return "3"
    return "4"


def invoice_dbt_days(payment_state, invoice_date_due, today):
    if payment_state == "paid":
        return 0
    if invoice_date_due and invoice_date_due < today:
        return (today - invoice_date_due).days
    return 0
