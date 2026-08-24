import re

from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError

from .service_security import require_n8n_fabric_service

_SHA256 = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)


class BrokerageLot(models.Model):
    _name = "sattva.brokerage.lot"
    _description = "Brokerage lot (not inventory stock)"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "id desc"

    name = fields.Char(string="Lot number", required=True, tracking=True)
    supplier_id = fields.Many2one(
        "res.partner",
        string="Supplier",
        required=True,
        ondelete="restrict",
        tracking=True,
    )
    purchase_order_id = fields.Many2one(
        "purchase.order",
        string="Purchase order",
        ondelete="set null",
    )
    state = fields.Selection(
        [
            ("quarantine", "Quarantine"),
            ("available", "Available for sale"),
            ("rejected", "Rejected"),
        ],
        default="quarantine",
        required=True,
        tracking=True,
        help="Quarantine is the default. Available for sale is an officer action.",
    )
    coa_filename = fields.Char(string="COA filename", readonly=True)
    coa_sha256 = fields.Char(string="COA SHA-256", readonly=True)
    moisture_pct = fields.Float(string="Moisture %", readonly=True)
    mesh_pass = fields.Boolean(string="Mesh pass", readonly=True)
    spec_moisture_max = fields.Float(string="Spec moisture max %", readonly=True)
    spec_mesh_required = fields.Boolean(string="Spec mesh required", readonly=True)
    coa_pass = fields.Boolean(
        string="COA compare pass",
        readonly=True,
        help="GREEN compare result. Not the same as available for sale.",
    )

    def action_release(self):
        if not self.env.user.has_group("sattva_compliance.group_compliance_officer"):
            raise AccessError("Only a compliance officer may release a lot.")
        for lot in self:
            if not lot.coa_pass:
                raise UserError(
                    f"Cannot release lot '{lot.name}': COA compare did not pass. "
                    "Quarantine stays until GREEN metrics meet spec."
                )
            lot.write({"state": "available"})
        return True


class FabricLot(models.AbstractModel):
    _name = "sattva.fabric.lot"
    _description = "Write GREEN COA compare onto a brokerage lot"

    @api.model
    def apply_coa_green(
        self,
        lot_id,
        filename,
        sha256,
        moisture_pct,
        mesh_pass,
        spec_moisture_max,
        spec_mesh_required,
    ):
        require_n8n_fabric_service(self.env)
        if not isinstance(filename, str) or not filename or "/" in filename or ".." in filename:
            raise UserError("filename must be a basename with no path")
        if not isinstance(sha256, str) or not _SHA256.match(sha256):
            raise UserError("sha256 must be 64 hex characters")
        if isinstance(moisture_pct, bool) or not isinstance(moisture_pct, (int, float)):
            raise UserError("moisture_pct must be a number")
        if isinstance(spec_moisture_max, bool) or not isinstance(
            spec_moisture_max, (int, float)
        ):
            raise UserError("spec_moisture_max must be a number")
        if not isinstance(mesh_pass, bool) or not isinstance(spec_mesh_required, bool):
            raise UserError("mesh_pass and spec_mesh_required must be boolean")
        lot = self.env["sattva.brokerage.lot"].browse(int(lot_id))
        if not lot.exists():
            raise UserError("lot not found")
        coa_pass = moisture_pct <= spec_moisture_max and mesh_pass == spec_mesh_required
        lot.sudo().write(
            {
                "coa_filename": filename,
                "coa_sha256": sha256.lower(),
                "moisture_pct": moisture_pct,
                "mesh_pass": mesh_pass,
                "spec_moisture_max": spec_moisture_max,
                "spec_mesh_required": spec_mesh_required,
                "coa_pass": coa_pass,
                "state": "quarantine",
            }
        )
        if not coa_pass:
            self._open_capa(lot)
        return {"lot_id": lot.id, "coa_pass": coa_pass, "state": lot.state}

    def _open_capa(self, lot):
        todo = self.env.ref("mail.mail_activity_data_todo")
        group = self.env.ref("sattva_compliance.group_compliance_officer")
        officers = group.sudo().users.filtered(
            lambda user: user.active
            and not user.share
            and not user.has_group("sattva_compliance.group_n8n_fabric_service")
        )
        if not officers:
            raise UserError("no eligible human assignee for compliance.officer")
        self.env["mail.activity"].sudo().create(
            {
                "activity_type_id": todo.id,
                "res_model_id": self.env["ir.model"]._get("sattva.brokerage.lot").id,
                "res_id": lot.id,
                "summary": "SATTVA: COA compare failed — lot remains quarantined",
                "user_id": officers.sorted("id")[0].id,
            }
        )
