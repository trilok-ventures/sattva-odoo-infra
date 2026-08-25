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
    "salmonella_absent",
    "spec_salmonella_required",
    "tpc_cfu",
    "spec_tpc_max",
    "pyruvic_umol",
    "spec_pyruvic_required",
    "spec_pyruvic_min",
    "coa_pass",
}


_SIDECAR_SUFFIX = ".green.json"


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


def _is_coa_sidecar_basename(name):
    if not _is_coa_basename(name):
        return False
    if not name.endswith(_SIDECAR_SUFFIX) or name.endswith(".pdf"):
        return False
    stem = name[: -len(_SIDECAR_SUFFIX)]
    return _is_coa_basename(stem)


def _require_finite(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise UserError(f"{name} must be a number")
    if not math.isfinite(value):
        raise UserError(f"{name} must be finite")
    return value


def _require_bool(value, name):
    if not isinstance(value, bool):
        raise UserError(f"{name} must be boolean")
    return value


def _coa_compare_pass(
    moisture_pct,
    mesh_pass,
    spec_moisture_max,
    spec_mesh_required,
    salmonella_absent,
    spec_salmonella_required,
    tpc_cfu,
    spec_tpc_max,
    pyruvic_umol,
    spec_pyruvic_required,
    spec_pyruvic_min,
):
    return (
        moisture_pct <= spec_moisture_max
        and (not spec_mesh_required or mesh_pass)
        and (not spec_salmonella_required or salmonella_absent)
        and tpc_cfu <= spec_tpc_max
        and (not spec_pyruvic_required or pyruvic_umol >= spec_pyruvic_min)
    )


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
    salmonella_absent = fields.Boolean(
        string="Salmonella absent", readonly=True, copy=False
    )
    spec_salmonella_required = fields.Boolean(
        string="Salmonella must be absent", readonly=True, copy=False
    )
    tpc_cfu = fields.Float(string="TPC CFU/g", readonly=True, copy=False)
    spec_tpc_max = fields.Float(string="Spec TPC max CFU/g", readonly=True, copy=False)
    pyruvic_umol = fields.Float(string="Pyruvic µmol/g", readonly=True, copy=False)
    spec_pyruvic_required = fields.Boolean(
        string="Pyruvic required", readonly=True, copy=False
    )
    spec_pyruvic_min = fields.Float(
        string="Spec pyruvic min µmol/g", readonly=True, copy=False
    )
    dossier_entry_ids = fields.One2many(
        "sattva.dossier.entry",
        "lot_id",
        string="Dossier hash index",
        readonly=True,
        help="Filenames and SHA-256 only. PDFs stay in Nextcloud.",
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
        self.check_access("write")
        vals = dict(vals)
        if _GREEN & set(vals):
            raise AccessError("GREEN COA fields are written only by apply_coa_green")
        if "state" in vals:
            raise UserError(
                "Lot state changes only via action_release or action_reject"
            )
        return super().write(vals)

    def _write_coa_green(self, vals):
        require_n8n_fabric_service(self.env)
        vals = dict(vals)
        extra = set(vals) - _GREEN
        if extra:
            raise UserError("apply_coa_green may only write GREEN fields")
        vals["state"] = "quarantine"
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
        return super().write({"state": "available"})

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
        return super().write({"state": "rejected"})

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
        salmonella_absent,
        spec_salmonella_required,
        tpc_cfu,
        spec_tpc_max,
        pyruvic_umol,
        spec_pyruvic_required,
        spec_pyruvic_min,
    ):
        require_n8n_fabric_service(self.env)
        if not _is_coa_basename(filename):
            raise UserError("filename must be a basename with no path")
        if not isinstance(sha256, str) or not _SHA256.match(sha256):
            raise UserError("sha256 must be 64 hex characters")
        moisture_pct = _require_finite(moisture_pct, "moisture_pct")
        spec_moisture_max = _require_finite(spec_moisture_max, "spec_moisture_max")
        mesh_pass = _require_bool(mesh_pass, "mesh_pass")
        spec_mesh_required = _require_bool(spec_mesh_required, "spec_mesh_required")
        salmonella_absent = _require_bool(salmonella_absent, "salmonella_absent")
        spec_salmonella_required = _require_bool(
            spec_salmonella_required, "spec_salmonella_required"
        )
        tpc_cfu = _require_finite(tpc_cfu, "tpc_cfu")
        spec_tpc_max = _require_finite(spec_tpc_max, "spec_tpc_max")
        pyruvic_umol = _require_finite(pyruvic_umol, "pyruvic_umol")
        spec_pyruvic_required = _require_bool(
            spec_pyruvic_required, "spec_pyruvic_required"
        )
        spec_pyruvic_min = _require_finite(spec_pyruvic_min, "spec_pyruvic_min")
        lot = self.env["sattva.brokerage.lot"].browse(int(lot_id))
        if not lot.exists():
            raise UserError("lot not found")
        coa_pass = _coa_compare_pass(
            moisture_pct,
            mesh_pass,
            spec_moisture_max,
            spec_mesh_required,
            salmonella_absent,
            spec_salmonella_required,
            tpc_cfu,
            spec_tpc_max,
            pyruvic_umol,
            spec_pyruvic_required,
            spec_pyruvic_min,
        )
        lot.sudo()._write_coa_green(
            {
                "coa_filename": filename,
                "coa_sha256": sha256.lower(),
                "moisture_pct": moisture_pct,
                "mesh_pass": mesh_pass,
                "spec_moisture_max": spec_moisture_max,
                "spec_mesh_required": spec_mesh_required,
                "salmonella_absent": salmonella_absent,
                "spec_salmonella_required": spec_salmonella_required,
                "tpc_cfu": tpc_cfu,
                "spec_tpc_max": spec_tpc_max,
                "pyruvic_umol": pyruvic_umol,
                "spec_pyruvic_required": spec_pyruvic_required,
                "spec_pyruvic_min": spec_pyruvic_min,
                "coa_pass": coa_pass,
            }
        )
        if not coa_pass:
            self._open_capa(lot)
        return {"lot_id": lot.id, "coa_pass": coa_pass, "state": lot.state}

    @api.model
    def resolve_coa_sidecar(self, lot_id, sidecar_basename):
        require_n8n_fabric_service(self.env)
        if not _is_coa_sidecar_basename(sidecar_basename):
            raise UserError("sidecar_basename must be {filename}.green.json")
        lot = self.env["sattva.brokerage.lot"].browse(int(lot_id))
        if not lot.exists():
            raise UserError("lot not found")
        path = lot.sudo().supplier_id.nextcloud_folder_path or ""
        if (
            not path.startswith("/Suppliers/")
            or "/Certificates/" not in path
            or not path.endswith("/")
            or ".." in path
        ):
            raise UserError("supplier vault path missing")
        href = f"{path}{sidecar_basename}"
        if not href.endswith(_SIDECAR_SUFFIX) or href.endswith(".pdf"):
            raise UserError("vault_href must end with .green.json")
        return {
            "lot_id": lot.id,
            "sidecar_basename": sidecar_basename,
            "vault_href": href,
        }

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
