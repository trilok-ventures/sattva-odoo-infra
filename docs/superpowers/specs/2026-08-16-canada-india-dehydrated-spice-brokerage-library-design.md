# Canada–India Dehydrated Spice Brokerage Library

**Status:** Draft design — pending user review  
**Date:** 2026-08-16  
**Owner:** Sattva Brokers OpCo  
**Scope:** Phase 0 knowledge plane and Phase 1 operating design; no live workflow, portal, access-control, or regulatory assertion is implemented by this document.

## 1. Purpose

Define the repeatable, disclosed-agent operating model for container-scale sales of dehydrated onion, garlic, and related spice ingredients from qualified Indian suppliers to Canadian food manufacturers. The model supports buyers such as ready-to-eat food, snack, sauce, paste, seasoning, and condiment manufacturers that can purchase at least one container after supplier approval.

Sattva Brokers coordinates the transaction on behalf of the supplier and buyer principals. It does not take title to product, hold inventory, become importer of record by default, or act as a document vault. Credibility comes from a consistent approval, documentary, quotation, and lot-release process.

This design creates a human knowledge library, not a live onboarding tracker. Odoo remains the source of truth for commercial and approval state, Nextcloud remains the evidence vault, and n8n remains a stateless integration bus.

## 2. Operating baseline and boundaries

### 2.1 First-delivery baseline

The standard first-delivery design is **DAP, named Canadian destination, Incoterms 2020**:

- The Indian supplier is the seller/exporter.
- The Canadian buyer is normally the importer of record and appoints or approves its customs broker.
- Sattva acts as a disclosed coordinator under authority from the principals.
- Delivery occurs at the buyer’s named Canadian receiving location or buyer-approved destination 3PL, ready for unloading.
- The buyer’s importer-of-record, Incoterm, delivery location, and approved logistics selection are controlled commercial decisions in Odoo.

This is a default operating profile, not an assertion that DAP is appropriate for every buyer or shipment. Any alternative Incoterm, importer-of-record arrangement, credit exposure, or logistics authority requires the applicable internal commercial, compliance, finance, and logistics approvals before it is used.

### 2.2 Provider comparison and charges

Before the first booking, Sattva may source comparable quotations from customs brokers, freight forwarders, and Canadian destination 3PLs. It charges a separately disclosed service fee for preparing the initial comparison.

The comparison normalizes service scope, route, transit, insurance, accessorial charges, exclusions, validity, and provider responsibilities. The buyer independently selects the provider and approves final provider payment. Sattva must not imply that the comparison replaces the buyer’s own commercial, customs, or legal review.

Live quotations, prices, client selections, contracts, invoices, and payment data belong in Odoo and, where files are required, Nextcloud. They must not be copied into Notion.

## 3. System ownership and information handling

| Domain | Authoritative system | Library role |
| --- | --- | --- |
| Buyer, supplier, quotes, Incoterms, orders, approvals, lots, invoices | Odoo CE | Explain the process and point users to the relevant Odoo action. |
| Certificates, agreements, COAs, shipping files, labels, customs evidence | Nextcloud | Define required evidence and folder conventions; never hold file contents or public links. |
| Notifications, validation, file movement | n8n | Explain approved workflow triggers; never store business state or RED payloads in logs. |
| SOPs, document catalogue, roles, decisions | Notion KB and this git design | Publish non-transactional guidance only. |
| Employee/buyer/supplier browser guidance | Middleware/Vercel, Phase 2+ | Serve curated GREEN-only content through role-aware views. |

Actual certificates, COAs, identity material, banking data, signed contracts, full lab reports, and file paths are RED. They stay in Nextcloud and are never exposed through Notion or a browser. Partner names, live prices, commercial terms, and order status are AMBER and remain in Odoo. Generic SOPs, anonymized examples, document names, pass/fail concepts, and approved product guidance are GREEN.

## 4. Roles and decision rights

| Role | Primary responsibility | May decide | Must not decide |
| --- | --- | --- | --- |
| Buyer procurement | Commercial needs and provider choice | Product need, destination, selected provider, commercial acceptance | Supplier compliance approval |
| Buyer QA | Ingredient acceptance criteria | Buyer specifications and lot acceptance/rejection | Release an unverified supplier |
| Buyer importer/finance | Importer and payment readiness | Importer-of-record acceptance, broker authorization, payment approval | Override food-safety release |
| Supplier commercial/export | Supply offer and export readiness | Offer, lead time, export documentation submission | Self-approval |
| Supplier QA | Product and lot evidence | Specifications, lot dossier submission, corrective evidence | Supplier PCP status |
| Sattva sales | Client and supplier coordination | Intake completeness and commercial escalation | Supplier approval; unapproved PO confirmation |
| Sattva compliance officer | Food-safety and evidence review | `review`, `approved`, or `blocked` supplier status in Odoo | Buyer payment approval |
| Sattva logistics | Provider comparison and execution coordination | Booking readiness and exception escalation | Change client commercial terms without approval |
| Customs broker / forwarder / 3PL | Scoped service delivery | Their own declared service execution | Access unrelated orders, Odoo, n8n, or Nextcloud |

Notion permissions mirror view/edit ownership only. Runtime authorization and separation of duties remain in Odoo now, with Keycloak/OIDC planned for later phases.

## 5. End-to-end first-container workflow

1. **Client intake:** Sales creates the buyer/lead in Odoo. The client supplies its receiving locations, intended use, container-volume capability, procurement and QA contacts, specification needs, and importer-of-record readiness.
2. **Commercial delivery profile:** The buyer’s approved Incoterm, named destination, importer role, broker authority, and permitted logistics options are recorded in Odoo after internal review.
3. **Supplier qualification:** Procurement creates the supplier in Odoo with `supplier_pcp_status = pending`. Evidence is assembled in Nextcloud. Only a compliance officer can mark the supplier approved; Odoo blocks purchase-order confirmation otherwise.
4. **Product and order alignment:** Buyer requirements for onion/garlic form, mesh size, granule/powder/chip format, quality limits, packaging, and label requirements are matched to the qualified supplier’s offer.
5. **Comparison service:** Sattva obtains and normalizes customs-broker, forwarder, and destination-3PL quotations. The buyer selects a provider and approves payment responsibility.
6. **Contract and booking readiness:** The principals execute their commercial documents. Logistics confirms that the buyer, supplier, selected providers, destination, and importer role are consistent before booking.
7. **Lot dossier and release:** The supplier submits the lot-specific documents to the vault. n8n may validate GREEN extracted values against the Odoo specification, but a failed or missing record keeps the lot quarantined and escalates to compliance.
8. **Export, customs, and destination handling:** The forwarder, broker, and 3PL receive only their scoped instructions and required release documents. The buyer or approved importer clears Canadian import requirements.
9. **Delivery and close:** The destination 3PL or buyer site confirms appointment, receipt, proof of delivery, and any quality discrepancy. Odoo retains the shipment, commercial, and exception state; Nextcloud retains the evidence dossier.
10. **Repeat-order governance:** Buyer service performance, supplier non-conformance, documentation failures, and logistics exceptions trigger the relevant Odoo review rather than a separate Notion scorecard.

## 6. Document catalogue

The future Notion library must express each entry as a template with: purpose, required/conditional status, classification, collecting role, reviewing role, authoritative system, retention, and escalation trigger. It must not include real documents, file contents, live status, or per-party records.

### 6.1 Buyer one-time onboarding pack

| Requirement | Purpose | Owner / reviewer | System |
| --- | --- | --- | --- |
| Legal entity and billing profile | Identify contracting principal | Buyer / Sales + Finance | Odoo; sensitive evidence in Nextcloud |
| Procurement, QA, receiving, finance contacts | Route approvals and exceptions | Buyer / Sales | Odoo |
| Delivery-site and receiving-capability profile | Confirm container delivery feasibility | Buyer / Logistics | Odoo |
| Product acceptance specification | Define permitted form, mesh, quality, packaging, label, and allergen requirements | Buyer QA / Compliance | Odoo; supporting files in Nextcloud |
| Importer-of-record and customs-broker readiness | Establish Canadian import responsibility | Buyer / Compliance + Logistics | Odoo; authorization files in Nextcloud |
| Initial Incoterm and delivery profile | Define allocation of transport, risk, and charges | Buyer / Sales + Finance + Logistics | Odoo |
| Provider-comparison service acknowledgement | Disclose Sattva’s comparison fee and buyer’s independent selection | Buyer / Sales + Finance | Odoo; signed file in Nextcloud |

### 6.2 Buyer per-lot or per-container pack

| Requirement | Purpose | Owner / reviewer | System |
| --- | --- | --- | --- |
| Purchase order and agreed specification | Bind quantity and acceptance criteria | Buyer / Sales + QA | Odoo |
| Selected logistics-provider approval | Evidence buyer’s selected broker, forwarder, and 3PL scope | Buyer / Logistics | Odoo |
| Importer/broker release confirmation | Confirm customs clearance authority | Buyer / Logistics | Odoo; evidence in Nextcloud |
| Delivery appointment and receiving instructions | Make destination handling executable | Buyer / Logistics | Odoo |
| Receipt, discrepancy, and acceptance record | Close delivery or trigger claim/CAPA | Buyer / QA + Logistics | Odoo; evidence in Nextcloud |

### 6.3 Supplier one-time qualification pack

| Requirement | Purpose | Owner / reviewer | System |
| --- | --- | --- | --- |
| Legal registration, Indian food/export registrations, and plant identity | Establish legal/exporting entity | Supplier / Compliance | Odoo + Nextcloud |
| QA and commercial contacts | Route evidence requests | Supplier / Procurement | Odoo |
| Current GFSI, HACCP, BRCGS, FSSC 22000, or equivalent evidence | Assess food-safety certification | Supplier / Compliance | Nextcloud; GREEN flags in Odoo |
| PCP/HACCP summary, sanitation, pest, training, recall, and traceability evidence | Establish preventive controls | Supplier / Compliance | Nextcloud |
| Signed NDA, code-of-conduct, and food-safety declaration | Set contractual and conduct baseline | Supplier / Sales + Compliance | Nextcloud; state in Odoo |
| Product capability and specification profile | Confirm onion/garlic form, mesh, capacity, MOQ, lead time, packaging, and controls | Supplier / Procurement + QA | Odoo; supporting evidence in Nextcloud |

An uncertified or incomplete supplier stays in Odoo `review` or `blocked` under the existing policy. It never receives PO-confirmation rights by exception alone.

### 6.4 Supplier per-lot or per-container pack

| Requirement | Purpose | Owner / reviewer | System |
| --- | --- | --- | --- |
| Commercial invoice and packing list | Identify shipment and contents | Supplier / Logistics | Nextcloud; references in Odoo |
| Lot traceability record and manufacturing/packing linkage | Trace product to source lot | Supplier / Compliance | Nextcloud; GREEN/hash references in Odoo |
| Product specification and certificate of analysis | Verify agreed quality parameters | Supplier / Compliance | Nextcloud; extracted GREEN values in Odoo |
| Labels, batch/lot marks, and packaging evidence | Match product and receiving requirements | Supplier / QA + Logistics | Nextcloud |
| Bill of lading or airway bill and certificate of origin where applicable | Support transport and customs process | Supplier / Logistics | Nextcloud; shipment state in Odoo |
| Product- or destination-specific evidence | Meet the approved compliance checklist | Supplier / Compliance | Nextcloud |

The precise Canadian and Indian customs, food-safety, lab, phytosanitary, and import documentation requirements must be validated for each product, origin, lot, and transaction by qualified regulatory/compliance and customs professionals. This catalogue is a controlled operating baseline, not legal advice or a certification of admissibility.

### 6.5 Provider onboarding and execution pack

| Provider | One-time baseline | Per-container baseline |
| --- | --- | --- |
| Customs broker | License/authority scope, service terms, escalation contact | Importer authorization, entry/release status, exception notice |
| Freight forwarder | Service capability, insurance scope, route/service terms | Booking confirmation, shipping instructions, transit exceptions |
| Destination 3PL | Food-handling capability, insurance, receiving capacity, service terms | Container/delivery appointment, handling instructions, proof of delivery, discrepancy report |

## 7. Notion library hierarchy

The target page is **Client & Supplier Onboarding Library** under `Trilok Ventures → Sattva Brokers → Knowledge Base`. It links to, rather than recreates, the existing System Fabric and supplier-qualification material.

```text
Client & Supplier Onboarding Library
├── Start Here: disclosed-agent model and system boundaries
├── Roles and access guide
├── Client onboarding
│   ├── DAP delivery-profile guide
│   ├── Provider-comparison service guide
│   ├── Buyer one-time document catalogue
│   └── Buyer per-container document catalogue
├── Supplier qualification
│   ├── Supplier one-time document catalogue
│   ├── Supplier per-lot document catalogue
│   └── Odoo compliance-gate guide
├── Logistics coordination
│   ├── Customs-broker guide
│   ├── Freight-forwarder guide
│   ├── Canadian 3PL guide
│   └── Delivery and exception guide
├── Document classification and retention guide
└── Middleware knowledge-access contract
```

The page remains private to its owner until the closed teamspace required by the versioned-KB policy exists. It must not be shared with clients, suppliers, investors, or agents as a substitute for the role-scoped portal.

## 8. Middleware knowledge-access contract

The custom middleware may later render curated, published GREEN/PUBLIC guidance from this hierarchy:

- employee users see role-relevant SOPs and escalation paths;
- buyers see their generic onboarding and delivery guidance, not other clients’ records;
- suppliers see their qualification and lot-submission guidance;
- logistics providers see only generic scoped-service instructions.

Middleware is never a second CRM, pricing system, document repository, or authorization source. It must not return Odoo/n8n/Nextcloud credentials, Nextcloud paths, RED file bytes, live price lists, or another principal’s commercial state.

## 9. Acceptance criteria for the subsequent implementation plan

1. The Notion hierarchy contains only non-transactional guidance and template document requirements.
2. Every document type identifies system of record, classification, owner, reviewer, retention, and escalation.
3. The supplier guide states and preserves the existing Odoo approval and PO-confirmation gate.
4. The buyer guide treats Incoterm, importer-of-record, provider selection, and charge allocation as Odoo-controlled client decisions with approval requirements.
5. The provider-comparison guide discloses Sattva’s service charge and leaves provider selection and final payment to buyer approval.
6. Middleware content is role-aware and GREEN-only; automated contract checks reject RED fields and vault-access details.
7. A controlled compliance review validates the transaction-specific Canadian and Indian requirements before any live process or portal claim is published.

## 10. Explicit non-goals

- No Notion database for client/supplier onboarding, documents, quotes, shipments, or approval status.
- No change to Odoo models, compliance logic, Nextcloud configuration, n8n workflow, Keycloak, Cloudflare, or Vercel deployment.
- No self-service buyer/supplier account provisioning.
- No legal, customs, food-safety, tax, insurance, or Incoterm advice beyond the operating assumptions stated here.
