from odoo import api, models
from odoo.exceptions import UserError

from .service_security import require_n8n_fabric_service


class FabricVault(models.AbstractModel):
    _name = "sattva.fabric.vault"
    _description = "Write vault path pointers without touching PCP"

    @api.model
    def set_partner_path(self, partner_id, requested_path, kind):
        require_n8n_fabric_service(self.env)
        if kind not in ("supplier", "client"):
            raise UserError("unknown path kind")
        if not requested_path or ".." in str(requested_path):
            raise UserError("invalid requested_path")
        partner = self.env["res.partner"].sudo().browse(int(partner_id))
        if not partner.exists():
            raise UserError("partner not found")
        field = (
            "nextcloud_folder_path" if kind == "supplier" else "nextcloud_client_folder_path"
        )
        current = partner[field]
        if current and current != requested_path:
            raise UserError("vault path already set")
        partner.sudo().write({field: requested_path})
        return True

    @api.model
    def set_order_path(self, order_id, requested_path):
        require_n8n_fabric_service(self.env)
        path = str(requested_path or "")
        if not path or ".." in path or "//" in path:
            raise UserError("invalid requested_path")
        if not path.startswith("/Clients/") or "/Orders/" not in path:
            raise UserError("order path must be under /Clients/{name}/Orders/")
        order = self.env["sale.order"].browse(int(order_id))
        if not order.exists():
            raise UserError("sale order not found")
        current = order.nextcloud_order_folder_path
        if current and current != path:
            raise UserError("vault path already set")
        order.sudo().write({"nextcloud_order_folder_path": path})
        return True
