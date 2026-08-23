from odoo import api, fields, models
from odoo.exceptions import UserError


class ProductTemplate(models.Model):
    _inherit = "product.template"

    sattva_crop = fields.Selection(
        [
            ("onion", "Onion"),
            ("garlic", "Garlic"),
            ("chilli", "Chilli"),
            ("turmeric", "Turmeric"),
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

    @api.depends("sattva_crop")
    def _compute_product_family_code(self):
        for template in self:
            template.product_family_code = (
                template.sattva_crop.upper() if template.sattva_crop else False
            )

    def _is_explicit_spec_change(self, vals, creating=False):
        present = {"spec_moisture_max", "spec_mesh_required"}.intersection(vals)
        if not present:
            return False
        if creating:
            moisture = vals.get("spec_moisture_max", 0) or 0
            mesh = bool(vals.get("spec_mesh_required", False))
            return bool(moisture) or mesh
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
