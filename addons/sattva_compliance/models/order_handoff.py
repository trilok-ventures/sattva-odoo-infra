from odoo import api, models

from .service_security import require_n8n_fabric_service


class FabricHandoff(models.AbstractModel):
    _name = "sattva.fabric.handoff"
    _description = "Create draft purchase intents without confirming the PCP gate"

    @api.model
    def create_po_intent(self, supplier_id, line_vals):
        require_n8n_fabric_service(self.env)
        return self.env["purchase.order"].sudo().create(
            {
                "partner_id": int(supplier_id),
                "order_line": [
                    (
                        0,
                        0,
                        {
                            "product_id": line["product_id"],
                            "product_qty": line["product_qty"],
                            "price_unit": line["price_unit"],
                        },
                    )
                    for line in line_vals
                ],
            }
        )
