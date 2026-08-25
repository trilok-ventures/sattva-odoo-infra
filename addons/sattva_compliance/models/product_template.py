from odoo import api, fields, models
from odoo.exceptions import UserError

_SPEC_WRITE_KEYS = {
    "spec_moisture_max",
    "spec_mesh_required",
    "spec_salmonella_required",
    "spec_tpc_max",
    "spec_pyruvic_min",
}


class ProductTemplate(models.Model):
    _inherit = "product.template"

    sattva_crop = fields.Selection(
        [
            ("onion", "Onion"),
            ("garlic", "Garlic"),
            ("chilli", "Chilli"),
            ("turmeric", "Turmeric"),
            ("coriander", "Coriander"),
            ("other", "Other"),
        ],
        string="Crop",
        help="GREEN product_family_code is this value uppercased (ONION, GARLIC, …).",
    )
    sattva_format = fields.Selection(
        [
            ("flake", "Flake"),
            ("powder", "Powder"),
            ("minced", "Minced"),
            ("other", "Other"),
        ],
        string="Format",
    )
    sattva_mesh_label = fields.Char(string="Mesh label")
    product_family_code = fields.Char(
        string="GREEN product family code",
        compute="_compute_product_family_code",
        store=True,
        readonly=True,
        help="Allowlist key for wf.lead.score. Derived from sattva_crop.",
    )
    spec_moisture_max = fields.Float(
        string="Spec moisture max %",
        help="GREEN COA compare threshold. Unset (0) means no live spec yet.",
    )
    spec_mesh_required = fields.Boolean(
        string="Spec mesh required",
        default=False,
    )
    spec_salmonella_required = fields.Boolean(
        string="Salmonella must be absent", default=True
    )
    spec_tpc_max = fields.Float(string="Spec TPC max CFU/g")
    spec_pyruvic_min = fields.Float(string="Spec pyruvic min µmol/g")
    spec_pyruvic_required = fields.Boolean(
        string="Pyruvic required",
        compute="_compute_spec_pyruvic_required",
        store=True,
        help="Required when crop is onion. Copy this flag into the GREEN CoA webhook.",
    )

    @api.depends("sattva_crop")
    def _compute_product_family_code(self):
        for template in self:
            template.product_family_code = (
                template.sattva_crop.upper() if template.sattva_crop else False
            )

    @api.depends("sattva_crop")
    def _compute_spec_pyruvic_required(self):
        for product in self:
            product.spec_pyruvic_required = product.sattva_crop == "onion"

    def _is_explicit_spec_change(self, vals, creating=False):
        present = _SPEC_WRITE_KEYS.intersection(vals)
        if not present:
            return False
        if creating:
            moisture = vals.get("spec_moisture_max", 0) or 0
            mesh = bool(vals.get("spec_mesh_required", False))
            salmonella_set = "spec_salmonella_required" in vals
            tpc = vals.get("spec_tpc_max", 0) or 0
            pyruvic = vals.get("spec_pyruvic_min", 0) or 0
            return bool(moisture) or mesh or salmonella_set or bool(tpc) or bool(pyruvic)
        return True

    def _check_spec_write(self, vals, creating=False):
        if not self._is_explicit_spec_change(vals, creating=creating):
            return
        if self.env.su or self.env.user.has_group(
            "sattva_compliance.group_compliance_officer"
        ):
            return
        raise UserError(
            "Only a compliance officer may change GREEN spec thresholds."
        )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_spec_write(vals, creating=True)
        return super().create(vals_list)

    def write(self, vals):
        self._check_spec_write(vals)
        return super().write(vals)
