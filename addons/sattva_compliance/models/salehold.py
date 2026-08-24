from odoo import api, models
from odoo.exceptions import UserError

from .service_security import require_n8n_fabric_service


class FabricSaleHold(models.AbstractModel):
    _name = "sattva.fabric.salehold"
    _description = "n8n may set a first-order hold; never confirms the sale"

    @api.model
    def set_hold(self, order_id, reason):
        require_n8n_fabric_service(self.env)
        if not isinstance(reason, str) or not reason.strip():
            raise UserError("reason required")
        order = self.env["sale.order"].browse(int(order_id))
        if not order.exists():
            raise UserError("sale order not found")
        order.sudo().write(
            {
                "sattva_compliance_hold": True,
                "sattva_hold_released": False,
                "sattva_hold_reason": reason.strip()[:255],
            }
        )
        order._create_hold_activity(reason.strip()[:255])
        return True
