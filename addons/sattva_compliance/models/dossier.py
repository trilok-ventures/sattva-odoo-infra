import os
import re

from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError

from .service_security import require_n8n_fabric_service

_SHA256 = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
_ENTRY_KEYS = frozenset({"filename", "sha256", "vault_href", "doc_kind"})
_DOC_KINDS = frozenset({"coa", "bl", "packing", "other"})
_MAX_ENTRIES = 20


def _is_basename(filename):
    if not isinstance(filename, str) or not filename:
        return False
    if filename != os.path.basename(filename):
        return False
    if any(char in filename for char in "/\\\0"):
        return False
    if ".." in filename:
        return False
    return True


def infer_doc_kind(filename):
    lower = (filename or "").lower()
    if "coa" in lower:
        return "coa"
    if "packing" in lower or "packlist" in lower:
        return "packing"
    if "lading" in lower or re.search(r"(^|_|-)(bl|bol)(\.|_|-|$)", lower):
        return "bl"
    return "other"


class DossierEntry(models.Model):
    _name = "sattva.dossier.entry"
    _description = "Vault filename + SHA-256 index row"
    _order = "id desc"

    sale_order_id = fields.Many2one(
        "sale.order",
        required=True,
        ondelete="cascade",
        index=True,
        readonly=True,
    )
    lot_id = fields.Many2one(
        "sattva.brokerage.lot",
        ondelete="set null",
        index=True,
        readonly=True,
    )
    filename = fields.Char(required=True, readonly=True)
    sha256 = fields.Char(required=True, readonly=True)
    vault_href = fields.Char(required=True, readonly=True)
    doc_kind = fields.Selection(
        [
            ("coa", "COA"),
            ("bl", "Bill of lading"),
            ("packing", "Packing list"),
            ("other", "Other"),
        ],
        required=True,
        readonly=True,
        default="other",
    )

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.context.get("sattva_dossier_index"):
            raise AccessError("Dossier index rows are written only by apply_index")
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.context.get("sattva_dossier_index"):
            raise AccessError("Dossier index rows are read-only.")
        return super().write(vals)

    def unlink(self):
        raise AccessError("Dossier index rows are read-only.")


class FabricDossier(models.AbstractModel):
    _name = "sattva.fabric.dossier"
    _description = "Upsert vault filename + SHA-256 index rows"

    @api.model
    def apply_index(self, sale_order_id, lot_id, entries):
        require_n8n_fabric_service(self.env)
        order = self.env["sale.order"].sudo().browse(int(sale_order_id))
        if not order.exists():
            raise UserError("sale order not found")
        order_path = order.nextcloud_order_folder_path or ""
        if (
            not order_path.startswith("/Clients/")
            or "/Orders/" not in order_path
            or ".." in order_path
            or not order_path.endswith("/")
        ):
            raise UserError("order vault path missing")
        lot = self.env["sattva.brokerage.lot"]
        if lot_id:
            lot = self.env["sattva.brokerage.lot"].sudo().browse(int(lot_id))
            if not lot.exists():
                raise UserError("lot not found")
            intent = order.purchase_intent_id
            if (
                lot.purchase_order_id
                and intent
                and lot.purchase_order_id != intent
            ):
                raise UserError("lot is not linked to this sale order")
        parsed = _parse_entries(entries, order_path)
        ids = []
        for item in parsed:
            ids.append(self._upsert(order, lot, item))
            self._maybe_flag_coa_mismatch(lot, item)
        return ids

    def _upsert(self, order, lot, item):
        existing = self.env["sattva.dossier.entry"].sudo().search(
            [
                ("sale_order_id", "=", order.id),
                ("filename", "=", item["filename"]),
            ],
            limit=1,
        )
        ctx = self.env["sattva.dossier.entry"].sudo().with_context(
            sattva_dossier_index=True
        )
        if existing:
            if (
                existing.sha256 != item["sha256"]
                or existing.vault_href != item["vault_href"]
                or existing.lot_id != lot
                or existing.doc_kind != item["doc_kind"]
            ):
                existing.with_context(sattva_dossier_index=True).write(
                    {
                        "sha256": item["sha256"],
                        "vault_href": item["vault_href"],
                        "lot_id": lot.id if lot else False,
                        "doc_kind": item["doc_kind"],
                    }
                )
            return existing.id
        return ctx.create(
            {
                "sale_order_id": order.id,
                "lot_id": lot.id if lot else False,
                "filename": item["filename"],
                "sha256": item["sha256"],
                "vault_href": item["vault_href"],
                "doc_kind": item["doc_kind"],
            }
        ).id

    def _maybe_flag_coa_mismatch(self, lot, item):
        if not lot or not lot.coa_filename or not lot.coa_sha256:
            return
        if item["filename"] != lot.coa_filename:
            return
        if item["sha256"] == lot.coa_sha256.lower():
            return
        summary = f"SATTVA: dossier hash mismatch for {item['filename']}"
        existing = self.env["mail.activity"].sudo().search(
            [
                ("res_model", "=", "sattva.brokerage.lot"),
                ("res_id", "=", lot.id),
                ("summary", "=", summary),
            ],
            limit=1,
        )
        if existing:
            return
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
                "summary": summary,
                "user_id": officers.sorted("id")[0].id,
            }
        )


def _parse_entries(entries, order_path):
    if not isinstance(entries, list) or not entries:
        raise UserError("entries required")
    if len(entries) > _MAX_ENTRIES:
        raise UserError("too many dossier entries")
    parsed = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise UserError("entry required")
        extra = set(entry) - _ENTRY_KEYS
        if extra:
            raise UserError("unknown dossier entry key forbidden")
        if any(isinstance(entry.get(key), (dict, list)) for key in entry):
            raise UserError("nested objects forbidden")
        filename = entry.get("filename")
        if not _is_basename(filename):
            raise UserError("filename must be a basename with no path")
        sha256 = entry.get("sha256")
        if not isinstance(sha256, str) or not _SHA256.match(sha256):
            raise UserError("sha256 must be 64 hex characters")
        href = entry.get("vault_href")
        if href != f"{order_path}{filename}":
            raise UserError("vault_href must stay under the order folder")
        kind = entry.get("doc_kind") or infer_doc_kind(filename)
        if kind not in _DOC_KINDS:
            raise UserError("unknown doc_kind")
        parsed.append(
            {
                "filename": filename,
                "sha256": sha256.lower(),
                "vault_href": href,
                "doc_kind": kind,
            }
        )
    return parsed
