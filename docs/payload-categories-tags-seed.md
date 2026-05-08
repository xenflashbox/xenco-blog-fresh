# Payload Admin — Categories & Tags Seed

**Purpose:** Create the taxonomy collections that support the editorial program launching via Blogcraft. Two collections need to be populated: `categories` (7 records) and `tags` (~100 records).

**Context:** The full taxonomy rationale lives in `docs/content-taxonomy-blogcraft.md`. This document is the execution-focused seed list.

---

## 1. Categories collection

Confirm the `categories` collection exists in Payload with at minimum these fields:

- `slug` (text, required, unique)
- `display_name` (text, required)
- `url_segment` (text, required)
- `description` (textarea, optional)
- `sort_order` (number, optional)

**Seed records:**

| slug | display_name | url_segment | description | sort_order |
|---|---|---|---|---|
| `compliance-regulation` | Compliance & Regulation | `/compliance` | Regulatory requirements and audit frameworks that apply to IT asset disposition across industries. | 1 |
| `data-security-destruction` | Data Security & Destruction | `/data-security` | Technical content on data destruction methods, NIST and IEEE standards, and chain-of-custody documentation. | 2 |
| `vendor-selection` | Vendor Selection & Due Diligence | `/vendor-selection` | How to evaluate, contract with, and manage ITAD vendors. | 3 |
| `value-recovery` | Value Recovery & Financial | `/value-recovery` | Remarketing, residual value, depreciation, and the financial economics of ITAD programs. | 4 |
| `risk-liability` | Risk & Liability | `/risk-liability` | Enforcement actions, cyber insurance, governance, and managing ITAD-related business risk. | 5 |
| `sustainability-esg` | Sustainability & ESG | `/sustainability` | Scope 3 emissions, e-waste law, circular economy, and ESG disclosure requirements. | 6 |
| `news-analysis` | News & Analysis | `/news` | Industry news, M&A coverage, earnings analysis, and commentary on events shaping the ITAD market. | 7 |

---

## 2. Tags collection

Confirm the `tags` collection exists with at minimum:

- `slug` (text, required, unique)
- `display_name` (text, required)
- `group` (select/enum, required — see groups below)
- `description` (textarea, optional)

**Tag groups (for admin UI organization and future filter UX):**

- `industry` — buyer vertical
- `persona` — buyer role
- `regulation` — specific regulatory framework or law
- `certification` — industry certifications
- `topic` — article format or topic type
- `media` — media type involved in destruction or retirement
- `method` — destruction method
- `vendor-relationship` — vendor selection / contract / chain-of-custody topics

**Seed records — industry group (17):**

| slug | display_name |
|---|---|
| `healthcare` | Healthcare |
| `financial-services` | Financial Services |
| `federal-government` | Federal Government |
| `state-local-government` | State & Local Government |
| `higher-education` | Higher Education |
| `k-12-education` | K–12 Education |
| `retail` | Retail |
| `manufacturing` | Manufacturing |
| `technology` | Technology |
| `energy-utilities` | Energy & Utilities |
| `telecommunications` | Telecommunications |
| `transportation` | Transportation |
| `automotive` | Automotive |
| `electronics` | Electronics |
| `legal` | Legal |
| `nonprofit` | Nonprofit |
| `defense-aerospace` | Defense & Aerospace |

**Seed records — persona group (11):**

| slug | display_name |
|---|---|
| `ciso` | CISO |
| `cfo` | CFO |
| `general-counsel` | General Counsel |
| `compliance-officer` | Compliance Officer |
| `it-procurement` | IT Procurement |
| `it-asset-manager` | IT Asset Manager |
| `facilities` | Facilities |
| `chief-sustainability-officer` | Chief Sustainability Officer |
| `esg-team` | ESG Team |
| `internal-audit` | Internal Audit |
| `risk-management` | Risk Management |

**Seed records — regulation group (16):**

| slug | display_name |
|---|---|
| `hipaa` | HIPAA |
| `hitech` | HITECH |
| `glba` | GLBA |
| `sox` | SOX |
| `pci-dss` | PCI-DSS |
| `ferpa` | FERPA |
| `coppa` | COPPA |
| `gdpr` | GDPR |
| `ccpa` | CCPA |
| `nist-800-88` | NIST SP 800-88 |
| `cmmc` | CMMC 2.0 |
| `fedramp` | FedRAMP |
| `fisma` | FISMA |
| `itar` | ITAR |
| `sb-253` | California SB 253 |
| `csrd` | EU CSRD |

**Seed records — certification group (9):**

| slug | display_name |
|---|---|
| `r2v3` | R2v3 |
| `naid-aaa` | NAID AAA |
| `e-stewards` | e-Stewards |
| `iso-14001` | ISO 14001 |
| `iso-27001` | ISO 27001 |
| `iso-9001` | ISO 9001 |
| `soc-2` | SOC 2 |
| `rios` | RIOS |
| `adisa` | ADISA |

**Seed records — topic group (12):**

| slug | display_name |
|---|---|
| `buyers-guide` | Buyer's Guide |
| `case-study` | Case Study |
| `how-to` | How-To |
| `checklist` | Checklist |
| `technical-reference` | Technical Reference |
| `rfp-template` | RFP Template |
| `contract-template` | Contract Template |
| `comparison` | Comparison |
| `explainer` | Explainer |
| `deep-dive` | Deep Dive |
| `news-jacking` | News Analysis |
| `data-journalism` | Data Journalism |

**Seed records — media group (13):**

| slug | display_name |
|---|---|
| `hdd` | HDD |
| `ssd` | SSD |
| `nvme` | NVMe |
| `tape` | Tape Media |
| `optical` | Optical Media |
| `mobile-device` | Mobile Device |
| `networking-equipment` | Networking Equipment |
| `storage-array` | Storage Array |
| `server` | Server |
| `laptop` | Laptop |
| `desktop` | Desktop |
| `printer-mfp` | Printer / MFP |
| `iot-device` | IoT Device |

**Seed records — method group (8):**

| slug | display_name |
|---|---|
| `shredding` | Shredding |
| `degaussing` | Degaussing |
| `crypto-erase` | Cryptographic Erase |
| `overwriting` | Overwriting |
| `disintegration` | Disintegration |
| `incineration` | Incineration |
| `on-site-destruction` | On-Site Destruction |
| `off-site-destruction` | Off-Site Destruction |

**Seed records — vendor-relationship group (6):**

| slug | display_name |
|---|---|
| `vendor-comparison` | Vendor Comparison |
| `vendor-selection` | Vendor Selection |
| `downstream-disclosure` | Downstream Disclosure |
| `chain-of-custody` | Chain of Custody |
| `value-recovery` | Value Recovery |
| `contract-negotiation` | Contract Negotiation |

**Total:** 92 tag records across 8 groups.

---

## 3. URL rewrite rules

The editorial program uses hub-and-spoke URL structure:

```
/[category-url-segment]/[cluster-slug]/              ← Hub article
/[category-url-segment]/[cluster-slug]/[spoke-slug]  ← Spoke article
```

Example URLs:

- `/compliance/healthcare-hipaa/` — hub article
- `/compliance/healthcare-hipaa/ocr-enforcement` — spoke
- `/vendor-selection/core-selection/rfp-template` — spoke
- `/data-security/destruction-methods/nist-clear-purge-destroy` — spoke

Confirm the Next.js routing supports this pattern. A `[...slug]` catch-all route at each pillar path is typical; alternatively a combined `/[pillar]/[cluster]/[[...spoke]]` dynamic segment will work.

Article records should store the full URL path as `url_path` alongside `slug` so lookups are unambiguous when clusters have spokes with the same slug as spokes in other clusters.

---

## 4. Acceptance tests

After seeding, these queries should return the expected counts:

```bash
curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/categories?limit=100" | jq '.totalDocs'
# Expected: 7

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?limit=200" | jq '.totalDocs'
# Expected: 92

# Each group should have the expected count
curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=industry" | jq '.totalDocs'
# Expected: 17

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=persona" | jq '.totalDocs'
# Expected: 11

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=regulation" | jq '.totalDocs'
# Expected: 16

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=certification" | jq '.totalDocs'
# Expected: 9

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=topic" | jq '.totalDocs'
# Expected: 12

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=media" | jq '.totalDocs'
# Expected: 13

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=method" | jq '.totalDocs'
# Expected: 8

curl -H "Authorization: Bearer ${CMS_API_KEY}" \
  "https://cms.compareitad.com/api/tags?where[group][equals]=vendor-relationship" | jq '.totalDocs'
# Expected: 6
```

Confirm back with the query outputs.
