{
    'name': 'Sattva Brokers: Compliance & Supplier Gates',
    'version': '1.0.0',
    'category': 'Customizations/Compliance',
    'summary': 'Enforces SFCR Part 4 compliance gates and PCP tracking for suppliers.',
    'description': """
        Adds Traffic Light compliance fields to Contacts (res.partner).
        Enforces a hard block on Purchase Orders if the supplier is not PCP Approved.
    """,
    'depends': ['base', 'purchase', 'sale', 'account', 'product', 'contacts', 'crm', 'mail'],
    'data': [
        'security/sattva_security.xml',
        'security/ir.model.access.csv',
        'data/product_category_data.xml',
        'data/replenishment_cron.xml',
        'views/res_partner_views.xml',
        'views/brokerage_lot_views.xml',
        'views/product_template_views.xml',
        'views/sale_order_views.xml',
        'views/payment_score_views.xml',
        'views/crm_lead_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
