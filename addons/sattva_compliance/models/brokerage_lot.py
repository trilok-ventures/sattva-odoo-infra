import math
import os
import re

from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError

from .service_security import require_n8n_fabric_service

_SHA256 = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
_GREEN = {
    "coa_filename",
    "coa_sha256",
    "moisture_pct",
    "mesh_pass",
    "spec_moisture_max",
    "spec_mesh_required",
    "coa_pass",
}


def _is_coa_basename(filename):
    if not isinstance(filename, str) or not filename:
        return False
    if filename != os.path.basename(filename):
        return False
    if any(char in filename for char in "/\\\0"):
        return False
    if ".." in filename:
        return False
    return True


def _coa_compare_pass(moisture_pct, mesh_pass, spec_moisture_max, spec_mesh_required):
    return moisture_pct <= spec_moisture_max and (not spec_mesh_required or mesh_pass)


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
        readonly=True,
        copy=False,
        tracking=True,
        help="Quarantine is the default. Available for sale is an officer action.",
    )
    coa_filename = fields.Char(string="COA filename", readonly=True, copy=False)
    coa_sha256 = fields.Char(string="COA SHA-256", readonly=True, copy=False)
    moisture_pct = fields.Float(string="Moisture %", readonly=True, copy=False)
    mesh_pass = fields.Boolean(string="Mesh pass", readonly=True, copy=False)
    spec_moisture_max = fields.Float(string="Spec moisture max %", readonly=True, copy=False)
    spec_mesh_required = fields.Boolean(
        string="Spec mesh required", readonly=True, copy=False
    )
    coa_pass = fields.Boolean(
        string="COA compare pass",
        readonly=True,
        copy=False,
        help="GREEN compare result. Not the same as available for sale.",
    )

    @api.model_create_multi
    def create(self, vals_list):
        cleaned = []
        for vals in vals_list:
            vals = dict(vals)
            vals["state"] = "quarantine"
            for field in _GREEN:
                vals.pop(field, None)
            cleaned.append(vals)
        return super().create(cleaned)

    def write(self, vals):
        vals = dict(vals)
        if _GREEN & set(vals) and not self.env.context.get("sattva_apply_coa_green"):
            raise AccessError("GREEN COA fields are written only by apply_coa_green")
        if vals.get("state") == "available" and not self.env.context.get(
            "sattva_lot_release"
        ):
            raise UserError("Available for sale is only set by action_release")
        if vals.get("state") == "rejected" and not self.env.context.get(
            "sattva_lot_reject"
        ):
            raise UserError("Rejected is only set by action_reject")
        return super().write(vals)

    def action_release(self):
        if self.env.user.has_group("sattva_compliance.group_n8n_fabric_service"):
            raise AccessError("n8n fabric service cannot release a lot.")
        if not self.env.user.has_group("sattva_compliance.group_compliance_officer"):
            raise AccessError("Only a compliance officer may release a lot.")
        for lot in self:
            if lot.state != "quarantine":
                raise UserError(
                    f"Cannot release lot '{lot.name}': not in quarantine."
                )
            if not lot.coa_pass or not _SHA256.match(lot.coa_sha256 or ""):
                raise UserError(
                    f"Cannot release lot '{lot.name}': hashed GREEN COA pass required."
                )
            lot.with_context(sattva_lot_release=True).write({"state": "available"})
        return True

    def action_reject(self):
        if self.env.user.has_group("sattva_compliance.group_n8n_fabric_service"):
            raise AccessError("n8n fabric service cannot reject a lot.")
        if not self.env.user.has_group("sattva_compliance.group_compliance_officer"):
            raise AccessError("Only a compliance officer may reject a lot.")
        for lot in self:
            if lot.state not in ("quarantine", "available"):
                raise UserError(
                    f"Cannot reject lot '{lot.name}': already rejected."
                )
            lot.with_context(sattva_lot_reject=True).write({"state": "rejected"})
        return True

    def message_post(self, *, attachments=None, attachment_ids=None, **kwargs):
        if attachments or attachment_ids:
            raise UserError(
                "COA PDFs stay in Nextcloud. Do not attach files to the lot."
            )
        return super().message_post(
            attachments=attachments, attachment_ids=attachment_ids, **kwargs
        )


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
        if not _is_coa_basename(filename):
            raise UserError("filename must be a basename with no path")
        if not isinstance(sha256, str) or not _SHA256.match(sha256):
            raise UserError("sha256 must be 64 hex characters")
        if isinstance(moisture_pct, bool) or not isinstance(moisture_pct, (int, float)):
            raise UserError("moisture_pct must be a number")
        if isinstance(spec_moisture_max, bool) or not isinstance(
            spec_moisture_max, (int, float)
        ):
            raise UserError("spec_moisture_max must be a number")
        if not math.isfinite(moisture_pct) or not math.isfinite(spec_moisture_max):
            raise UserError("moisture values must be finite")
        if not isinstance(mesh_pass, bool) or not isinstance(spec_mesh_required, bool):
            raise UserError("mesh_pass and spec_mesh_required must be boolean")
        lot = self.env["sattva.brokerage.lot"].browse(int(lot_id))
        if not lot.exists():
            raise UserError("lot not found")
        coa_pass = _coa_compare_pass(
            moisture_pct, mesh_pass, spec_moisture_max, spec_mesh_required
        )
        lot.sudo().with_context(sattva_apply_coa_green=True).write(
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
