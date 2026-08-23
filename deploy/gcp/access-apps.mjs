/**
 * Path B Access application payloads.
 * Browser HTTPS only — never set allow_authenticate_via_warp.
 */
export const ZONE = "trilokventures.org";

export const HOSTS = Object.freeze({
  odoo: `sattva.${ZONE}`,
  vault: `vault.${ZONE}`,
  n8n: `n8n.${ZONE}`,
});

const FORBIDDEN_HOSTS = Object.freeze([
  `*.${ZONE}`,
  `app.${ZONE}`,
  `auth.${ZONE}`,
  `upload.${ZONE}`,
  ZONE,
  `www.${ZONE}`,
]);

function emailDomainInclude(domain) {
  return { email_domain: { domain } };
}

function emailInclude(address) {
  return { email: { email: address } };
}

function parseItEmails(raw) {
  const list = String(raw || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) {
    throw new Error("CF_ACCESS_IT_EMAILS must list at least one IT mailbox");
  }
  for (const email of list) {
    if (!email.endsWith(`@${ZONE}`)) {
      throw new Error(`IT email must be @${ZONE}: ${email}`);
    }
  }
  return list;
}

export function buildAccessApps({ itEmails = process.env.CF_ACCESS_IT_EMAILS } = {}) {
  const it = parseItEmails(itEmails);
  const employeeInclude = [emailDomainInclude(ZONE)];
  const itInclude = it.map(emailInclude);

  const apps = [
    {
      name: "Sattva Odoo",
      type: "self_hosted",
      domain: HOSTS.odoo,
      destinations: [{ type: "public", uri: HOSTS.odoo }],
      allow_authenticate_via_warp: false,
      session_duration: "24h",
      app_launcher_visible: true,
      policies: [
        {
          name: "Employees @trilokventures.org",
          decision: "allow",
          include: employeeInclude,
        },
      ],
    },
    {
      name: "Sattva Vault",
      type: "self_hosted",
      domain: HOSTS.vault,
      destinations: [{ type: "public", uri: HOSTS.vault }],
      allow_authenticate_via_warp: false,
      session_duration: "24h",
      app_launcher_visible: true,
      policies: [
        {
          name: "Employees @trilokventures.org",
          decision: "allow",
          include: employeeInclude,
        },
      ],
    },
    {
      name: "n8n editor",
      type: "self_hosted",
      domain: HOSTS.n8n,
      destinations: [{ type: "public", uri: HOSTS.n8n }],
      allow_authenticate_via_warp: false,
      session_duration: "24h",
      app_launcher_visible: true,
      policies: [
        {
          name: "IT operators only",
          decision: "allow",
          include: itInclude,
        },
      ],
    },
    {
      name: "n8n webhooks HMAC",
      type: "self_hosted",
      domain: `${HOSTS.n8n}/webhook`,
      destinations: [{ type: "public", uri: `${HOSTS.n8n}/webhook/*` }],
      allow_authenticate_via_warp: false,
      session_duration: "24h",
      app_launcher_visible: false,
      policies: [
        {
          name: "Bypass webhook HMAC",
          decision: "bypass",
          include: [{ everyone: {} }],
        },
      ],
    },
  ];

  for (const app of apps) {
    if (app.allow_authenticate_via_warp !== false) {
      throw new Error(`${app.name} must set allow_authenticate_via_warp false`);
    }
    const uris = [app.domain, ...app.destinations.map((d) => d.uri)];
    for (const uri of uris) {
      for (const banned of FORBIDDEN_HOSTS) {
        if (uri === banned || uri.startsWith(`${banned}/`)) {
          throw new Error(`${app.name} must not cover ${banned}`);
        }
      }
    }
  }

  return apps;
}
