from odoo import api, models

from .credit_access import check_move_credit_vals


class AccountMove(models.Model):
    _inherit = "account.move"

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            check_move_credit_vals(self.env, vals)
        return super().create(vals_list)

    def write(self, vals):
        check_move_credit_vals(self.env, vals, moves=self)
        return super().write(vals)
