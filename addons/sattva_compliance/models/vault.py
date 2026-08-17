from odoo import api, models
from odoo.exceptions import UserError


class FabricVault(models.AbstractModel):
    _name = "sattva.fabric.vault"
    _description = "Write vault path pointers without touching PCP"

    @api.model
    def set_partner_path(self, partner_id, requested_path, kind):
        if kind not in ("supplier", "client"):
            raise UserError("unknown path kind")
        if not requested_path or ".." in str(requested_path):
            raise UserError("invalid requested_path")
        partner = self.env["res.partner"].browse(int(partner_id))
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
