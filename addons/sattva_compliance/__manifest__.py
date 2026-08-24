{
    'name': 'Sattva Brokers: Compliance & Supplier Gates',
    'version': '1.1.0',
    'category': 'Customizations/Compliance',
    'summary': 'Enforces SFCR Part 4 compliance gates and PCP tracking for suppliers.',
    'description': """
        Adds Traffic Light compliance fields to Contacts (res.partner).
        Enforces a hard block on Purchase Orders if the supplier is not PCP Approved.
        First-order sale holds, GREEN lot records, and per-SKU spec thresholds.
    """,
    'depends': ['base', 'purchase', 'contacts', 'crm', 'sale', 'product'],
    'data': [
        'security/sattva_security.xml',
        'security/ir.model.access.csv',
        'views/res_partner_views.xml',
        'views/sale_order_views.xml',
        'views/product_views.xml',
        'views/sattva_lot_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
