from odoo import api, fields, models
from odoo.exceptions import UserError

from .service_security import require_n8n_fabric_service

FORBIDDEN_GREEN_KEYS = {
    "bytes",
    "pdf",
    "path",
    "nextcloud_folder_path",
    "file_bytes",
    "coa_pdf",
    "file_path",
    "vault_path",
    "webdav",
}


class SattvaLot(models.Model):
    _name = "sattva.lot"
    _description = "Brokerage lot (quarantine default; GREEN metrics only)"
    _order = "id desc"

    name = fields.Char(required=True, default="New")
    product_id = fields.Many2one("product.product", ondelete="restrict")
    sku = fields.Char()
    supplier_id = fields.Many2one("res.partner", ondelete="restrict")
    sale_order_id = fields.Many2one("sale.order", ondelete="set null")
    buyer_partner_id = fields.Many2one(
        related="sale_order_id.partner_id",
        store=True,
        readonly=True,
    )
    state = fields.Selection(
        [
            ("quarantine", "Quarantine"),
            ("available", "Available"),
            ("rejected", "Rejected"),
        ],
        default="quarantine",
        required=True,
        index=True,
    )
    moisture_pct = fields.Float()
    mesh_pass = fields.Boolean()
    salmonella_absent = fields.Boolean()
    tpc_cfu_g = fields.Integer()
    pyruvic_acid_umol = fields.Float()
    coa_pass = fields.Boolean(default=False)
    coa_sha256 = fields.Char()

    @api.model
    def write_green(self, payload):
        require_n8n_fabric_service(self.env)
        if payload is None or not isinstance(payload, dict):
            raise UserError("payload required")
        self._assert_no_red_keys(payload)
        sha256 = payload.get("coa_sha256") or payload.get("sha256")
        if not isinstance(sha256, str) or len(sha256) != 64:
            raise UserError("sha256 must be 64 hex characters")
        sha256 = sha256.lower()
        lot = self._find_or_create(payload)
        values = {
            "coa_sha256": sha256,
        }
        if "moisture_pct" in payload:
            values["moisture_pct"] = float(payload["moisture_pct"])
        if "mesh_pass" in payload:
            values["mesh_pass"] = bool(payload["mesh_pass"])
        if "salmonella_absent" in payload:
            values["salmonella_absent"] = bool(payload["salmonella_absent"])
        if "tpc_cfu_g" in payload:
            values["tpc_cfu_g"] = int(payload["tpc_cfu_g"])
        if "pyruvic_acid_umol" in payload:
            values["pyruvic_acid_umol"] = float(payload["pyruvic_acid_umol"])
        sku = payload.get("sku")
        if isinstance(sku, str) and sku:
            values["sku"] = sku[:64]
        lot.sudo().write(values)
        lot._evaluate_green_spec()
        return {
            "id": lot.id,
            "state": lot.state,
            "coa_pass": lot.coa_pass,
        }

    @api.model
    def _assert_no_red_keys(self, value):
        if value is None or not isinstance(value, dict):
            return
        for key, child in value.items():
            if key in FORBIDDEN_GREEN_KEYS:
                raise UserError(f"RED key forbidden: {key}")
            if isinstance(child, dict):
                self._assert_no_red_keys(child)

    @api.model
    def _find_or_create(self, payload):
        lot_id = payload.get("lot_id")
        if lot_id:
            lot = self.browse(int(lot_id))
            if not lot.exists():
                raise UserError("lot not found")
            return lot
        sku = payload.get("sku")
        if not isinstance(sku, str) or not sku:
            filename = payload.get("filename")
            sku = filename.rsplit(".", 1)[0] if isinstance(filename, str) else "LOT"
        product = self.env["product.product"]
        product_id = payload.get("product_id")
        if product_id:
            product = self.env["product.product"].browse(int(product_id))
            if not product.exists():
                raise UserError("product not found")
        elif sku:
            product = self.env["product.product"].search(
                [("default_code", "=", sku)], limit=1
            )
        return self.sudo().create(
            {
                "name": sku,
                "sku": sku,
                "product_id": product.id if product else False,
                "state": "quarantine",
            }
        )

    def _evaluate_green_spec(self):
        for lot in self:
            tmpl = lot.product_id.product_tmpl_id if lot.product_id else False
            passed, configured = lot._spec_result(tmpl)
            vals = {"coa_pass": passed}
            if passed and configured:
                vals["state"] = "available"
            elif lot.coa_sha256:
                vals["state"] = "quarantine" if not passed else lot.state
                if not passed:
                    vals["state"] = "quarantine"
            lot.sudo().write(vals)

    def _spec_result(self, tmpl):
        self.ensure_one()
        if not tmpl:
            return False, False
        configured = False
        passed = True
        if tmpl.sattva_moisture_max:
            configured = True
            if self.moisture_pct > tmpl.sattva_moisture_max:
                passed = False
        elif "moisture_pct" in self._fields and self.moisture_pct:
            passed = False
        if tmpl.sattva_mesh_required:
            configured = True
            if not self.mesh_pass:
                passed = False
        if tmpl.sattva_salmonella_required:
            configured = True
            if not self.salmonella_absent:
                passed = False
        if tmpl.sattva_tpc_max:
            configured = True
            if not self.tpc_cfu_g or self.tpc_cfu_g > tmpl.sattva_tpc_max:
                passed = False
        elif self.tpc_cfu_g:
            passed = False
        if tmpl.sattva_pyruvic_min:
            configured = True
            if self.pyruvic_acid_umol < tmpl.sattva_pyruvic_min:
                passed = False
        elif self.pyruvic_acid_umol:
            passed = False
        if not configured:
            return False, False
        return passed, configured
