from odoo import models, api
from odoo.exceptions import UserError

class PurchaseOrder(models.Model):
    _inherit = 'purchase.order'

    def button_confirm(self):
        # The Supplier Firewall: Gate Check
        for order in self:
            if order.partner_id:
                # If they are a vendor/supplier and their status isn't approved
                if order.partner_id.supplier_pcp_status != 'approved':
                    raise UserError(
                        f"Compliance Gate Blocked: Cannot confirm PO.\n"
                        f"Supplier '{order.partner_id.name}' has a PCP Status of '{order.partner_id.supplier_pcp_status}'.\n"
                        f"Compliance Officer must verify HACCP/Sanitation records in the Vault and approve the supplier first."
                    )
        
        # If the gate is passed, proceed with standard Odoo PO confirmation
        return super(PurchaseOrder, self).button_confirm()
