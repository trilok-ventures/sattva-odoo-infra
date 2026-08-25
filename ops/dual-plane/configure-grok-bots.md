# Configure Grok Bots from git

Eligibility: Cursor Ultra, Cursor Teams Premium, or SuperGrok Heavy. App: https://cursor.com/bot/onboarding

1. Create Bot named `Chief of Staff`. Paste `ops/dual-plane/bots/chief-of-staff.md` into the description (body after the heading).
2. Create Bot named `PA`. Paste `ops/dual-plane/bots/pa.md` the same way.
3. Settings → Auto-review: Require Approval for send, publish, purchase, delete. Deny for URLs matching odoo, nextcloud, keycloak, n8n, secretmanager.
4. Team / dashboard Grok Bot: keep Cloud Agents launch enabled. Do not sign either Bot into Odoo or Nextcloud. Do not store those passwords in the VM.
5. Do not create a third Bot in this plan.
6. Edit Pull Request Router and Security Reviewer using `ops/dual-plane/automation-landing.md`.
