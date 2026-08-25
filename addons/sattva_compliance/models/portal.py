from odoo import api, models
from odoo.exceptions import AccessError, UserError

_PORTAL_STATES = frozenset({"quarantine", "available", "rejected"})
_PORTAL_KEYS = (
    "id",
    "sku",
    "state",
    "coa_pass",
    "coa_sha256",
    "moisture_pct",
    "mesh_pass",
    "salmonella_absent",
    "tpc_cfu",
    "pyruvic_umol",
    "buyer_order",
)


def _require_internal_bff_reader(env):
    if env.user.share:
        raise AccessError("share users cannot call the buyer lot portal")
    if env.user.has_group("sattva_compliance.group_n8n_fabric_service"):
        raise AccessError("n8n fabric service cannot call the buyer lot portal")
    if not env.user.has_group("base.group_user"):
        raise AccessError("internal user required for the buyer lot portal")


def _buyer_partner_id(value):
    if value in (False, None, 0, "0", ""):
        return False
    try:
        partner_id = int(value)
    except (TypeError, ValueError) as exc:
        raise UserError("buyer_partner_id must be an integer") from exc
    if partner_id <= 0:
        raise UserError("buyer_partner_id must be an integer")
    return partner_id


class FabricPortal(models.AbstractModel):
    _name = "sattva.fabric.portal"
    _description = "Read-only GREEN lot projection for the operations BFF"

    @api.model
    def list_lots(self, buyer_partner_id=False):
        _require_internal_bff_reader(self.env)
        partner_id = _buyer_partner_id(buyer_partner_id)
        Lot = self.env["sattva.brokerage.lot"].sudo()
        Entry = self.env["sattva.dossier.entry"].sudo()
        if partner_id:
            partner = self.env["res.partner"].sudo().browse(partner_id)
            if not partner.exists():
                raise UserError("buyer partner not found")
            orders = self.env["sale.order"].sudo().search(
                [("partner_id", "child_of", partner.id)]
            )
            entries = Entry.search(
                [
                    ("sale_order_id", "in", orders.ids),
                    ("lot_id", "!=", False),
                ]
            )
            lots = entries.mapped("lot_id")
        else:
            lots = Lot.search([])
            entries = Entry.search([("lot_id", "in", lots.ids)])
        order_name_by_lot = {}
        for entry in entries.sorted("id"):
            if entry.lot_id and entry.lot_id.id not in order_name_by_lot:
                order_name_by_lot[entry.lot_id.id] = entry.sale_order_id.name
        rows = []
        for lot in lots.sorted("id"):
            if lot.state not in _PORTAL_STATES:
                continue
            rows.append(self._lot_row(lot, order_name_by_lot.get(lot.id) or False))
        return rows

    def _lot_row(self, lot, buyer_order):
        row = {
            "id": lot.name,
            "sku": "",
            "state": lot.state,
            "coa_pass": bool(lot.coa_pass),
            "coa_sha256": lot.coa_sha256 or "",
            "moisture_pct": lot.moisture_pct,
            "mesh_pass": bool(lot.mesh_pass),
            "salmonella_absent": bool(lot.salmonella_absent),
            "tpc_cfu": lot.tpc_cfu,
            "pyruvic_umol": lot.pyruvic_umol,
            "buyer_order": buyer_order or False,
        }
        extra = set(row) - set(_PORTAL_KEYS)
        if extra:
            raise UserError("portal lot row leaked keys")
        return {key: row[key] for key in _PORTAL_KEYS}
