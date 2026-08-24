from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    sattva_crop = fields.Selection(
        [
            ("onion", "Onion"),
            ("garlic", "Garlic"),
            ("chilli", "Chilli"),
            ("coriander", "Coriander"),
            ("other", "Other"),
        ],
        string="Sattva crop",
    )
    spec_moisture_max = fields.Float(string="Spec moisture max %", default=6.0)
    spec_mesh_required = fields.Boolean(string="Spec mesh required", default=False)
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
    def _compute_spec_pyruvic_required(self):
        for product in self:
            product.spec_pyruvic_required = product.sattva_crop == "onion"
