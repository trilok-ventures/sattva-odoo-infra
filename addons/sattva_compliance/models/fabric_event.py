from odoo import fields, models


class FabricEvent(models.Model):
    _name = "sattva.fabric.event"
    _description = "Sattva Fabric Event"
    _order = "id"

    event_type = fields.Char(required=True, index=True)
    partner_id = fields.Many2one(
        "res.partner",
        required=True,
        index=True,
        ondelete="cascade",
    )
    requested_path = fields.Char(required=True)
    state = fields.Char(default="queued", required=True, index=True)
