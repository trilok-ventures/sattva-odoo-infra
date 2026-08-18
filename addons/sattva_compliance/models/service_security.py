from odoo.exceptions import AccessError


def require_n8n_fabric_service(env):
    if env.is_superuser() or env.user.has_group(
        "sattva_compliance.group_n8n_fabric_service"
    ):
        return
    raise AccessError("n8n Fabric Service group required")
