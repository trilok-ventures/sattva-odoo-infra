{
    'name': 'Sattva Brokers: Compliance & Supplier Gates',
    'version': '1.0.0',
    'category': 'Customizations/Compliance',
    'summary': 'Enforces SFCR Part 4 compliance gates and PCP tracking for suppliers.',
    'description': """
        Adds Traffic Light compliance fields to Contacts (res.partner).
        Enforces a hard block on Purchase Orders if the supplier is not PCP Approved.
    """,
    'depends': ['base', 'purchase', 'contacts'],
    'data': ['views/res_partner_views.xml'],
    'installable': True,
    'application': False,
    'auto_install': False,
}
