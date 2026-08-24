from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    sattva_moisture_max = fields.Float(
        string="Moisture max %",
        help="GREEN spec. Per-SKU threshold; not a global PDF constant.",
    )
    sattva_mesh_required = fields.Boolean(
        string="Mesh pass required",
        default=False,
    )
    sattva_salmonella_required = fields.Boolean(
        string="Salmonella-absent required",
        default=False,
        help="When set, lot GREEN salmonella_absent must be True to pass.",
    )
    sattva_tpc_max = fields.Integer(
        string="TPC max CFU/g",
        help="GREEN spec. 0 means unset (fail closed when a TPC measurement is sent).",
    )
    sattva_pyruvic_min = fields.Float(
        string="Pyruvic min µmol/g",
        help="GREEN spec. 0 means unset (fail closed when a pyruvic measurement is sent).",
    )
    sattva_crop = fields.Char(string="GREEN crop label")
    sattva_format = fields.Char(string="GREEN format label")
    sattva_mesh_label = fields.Char(string="GREEN mesh label")
