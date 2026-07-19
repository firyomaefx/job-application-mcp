# MCP Monetization Proposal — Open-Source Job Application MCP

A free and paid business proposal for a **local-first, open-source job
application assistant** built on the Model Context Protocol.

---

## 1. Business Concept

Build a **local-first, open-source job application assistant** using MCP.

The product helps users:

- Analyse job vacancies
- Match jobs against their CV
- Prepare tailored documents
- Auto-fill application forms
- Review answers
- Submit applications with approval
- Track application results

MCP itself is an open standard. Revenue should come from hosting, AI
processing, maintained integrations, updates, support and business services —
not from selling the MCP protocol. ([Model Context Protocol][1])

---

## 2. Recommended Business Model

Use an **open-core plus paid-service model**.

```text
Open-Source Local Core
          ↓
Free GitHub Distribution
          ↓
Paid AI and Cloud Services
          ↓
Pro Subscription
          ↓
Business and Enterprise Plans
```

### Key Principle

Keep essential local functionality free.

Charge for services that require:

- Continuous maintenance
- Cloud infrastructure
- AI usage
- Premium support
- Secure synchronization
- Business management
- Maintained website adapters

This makes the paid plan harder to copy because the important paid value runs
through your hosted services.

---

## 3. Free Community Version

### Purpose

- Build trust
- Attract GitHub users
- Collect feedback
- Gain contributors
- Create product awareness
- Demonstrate the system safely

### Included Features

| Feature                    | Free |
| -------------------------- | ---: |
| Local MCP server           |  Yes |
| Local desktop application  |  Yes |
| Candidate profile          |  Yes |
| Basic job analysis         |  Yes |
| Manual job URL import      |  Yes |
| Basic form autofill        |  Yes |
| CV upload                  |  Yes |
| Application preview        |  Yes |
| User-approved submission   |  Yes |
| Local application tracking |  Yes |
| Local database             |  Yes |
| Community updates          |  Yes |
| Community support          |  Yes |

### Free Limitations

- One user profile
- One device
- Manual setup
- Local storage only
- Basic CV matching
- No cloud backup
- No multi-device synchronization
- No premium AI models
- No guaranteed website support
- No priority bug fixes
- No business dashboard
- No automatic follow-up system

The free edition should remain genuinely useful. Open-source software must
allow users to use, modify and redistribute the covered code. A simple hidden
feature switch inside open-source code can be removed by users.
([Open Source Initiative][2])

> This repository implements the free community version. The paid services
> below are out of scope here and would live in separate hosted services.

---

## 4. Paid Pro Version

### Recommended Price

- **Pro Monthly:** RM39
- **Pro Annual:** RM349
- **Pro Plus:** RM79 monthly
- **Business:** From RM299 monthly

### Pro Features

| Feature                   |           Free |              Pro |
| ------------------------- | -------------: | ---------------: |
| Local MCP and autofill    |            Yes |              Yes |
| AI CV tailoring           | Limited/manual | Included credits |
| AI cover letters          |             No |              Yes |
| Screening-answer drafting |          Basic |         Advanced |
| Job-match scoring         |          Basic |         Detailed |
| Multiple CV profiles      |        Limited |              Yes |
| Encrypted cloud backup    |             No |              Yes |
| Multi-device use          |             No |      Two devices |
| Premium website adapters  |             No |              Yes |
| Automatic updates         |          Basic |         Priority |
| Application analytics     |          Basic |         Advanced |
| Interview reminders       |             No |              Yes |
| Email status detection    |             No |          Optional |
| Priority support          |             No |              Yes |
| Early features            |             No |              Yes |

### Pro Plus Features

- Higher AI-credit allowance
- Advanced CV comparison
- Application success analytics
- Interview preparation
- Follow-up message generation
- Salary-range analysis
- More connected devices
- Faster support

### Business Features

Designed for:

- Career coaches
- Universities
- Recruitment consultants
- Employment agencies
- Training centres

Include:

- Multiple candidate accounts
- Team members
- Candidate approval workflow
- Central dashboard
- Usage reporting
- Role permissions
- Audit history
- White-label options
- Private deployment

---

## 5. AI Credit Strategy

Do not offer unlimited AI usage initially.

### Example

| Package                |                          Included |
| ---------------------- | --------------------------------: |
| Pro                    |  30 tailored applications monthly |
| Pro Plus               | 100 tailored applications monthly |
| Additional 20 credits  |                              RM15 |
| Additional 100 credits |                              RM49 |

One application credit may include:

- Job-description analysis
- Match scoring
- CV-tailoring suggestions
- Cover-letter generation
- Screening-answer drafting

This protects profit margins when AI-provider costs increase.

---

## 6. How Paid Access Is Unlocked

### Recommended Unlock Flow

```text
User Selects Pro
       ↓
Checkout and Payment
       ↓
Payment Webhook Confirms Purchase
       ↓
Licence Service Creates Entitlement
       ↓
User Receives Licence Key
       ↓
Desktop App Activates Device
       ↓
Premium Cloud Services Become Available
```

### Activation Method

The user enters:

- Account email
- Licence key
- Device name

The app sends these to your licence server.

The server returns a signed entitlement token containing:

```json
{
  "plan": "pro",
  "device_limit": 2,
  "ai_credits": 30,
  "expires_at": "2026-08-19",
  "features": [
    "cloud_sync",
    "ai_cv_tailoring",
    "premium_adapters",
    "advanced_analytics"
  ]
}
```

### Recommended Licence Rules

- Maximum two activated devices
- Validate subscription periodically
- Allow 7–14 days of offline use
- Never delete local user data after expiry
- Expired users return to the free plan
- Cloud premium services stop after expiry
- Allow users to deactivate old devices
- Store no payment secrets inside the desktop app

Lemon Squeezy supports software licence generation, activation, validation and
deactivation. Subscription-linked keys can remain active while the subscription
is active. ([docs.lemonsqueezy.com][3])

---

## 7. Preventing Easy Paid-Feature Bypass

Do not rely only on:

```text
if licence == active:
    enable_pro()
```

Users can modify this when the code is open source.

### Better Protection

Keep these services on your server:

- Premium AI processing
- Encrypted synchronization
- Premium adapter updates
- Team dashboards
- Usage analytics
- Managed backups
- Business administration
- Licence entitlement
- Priority update channels

The local application can remain open source, while paid cloud services require
an authenticated account.

---

## 8. Recommended Licence Structure

### Preferred Model

**Community core:** AGPLv3
**Hosted services:** Proprietary service
**Enterprise embedding:** Commercial licence

AGPL requires operators of modified network versions to offer corresponding
source code to users interacting with that software remotely. A separate
commercial licence can be offered to businesses that do not want AGPL
obligations. Legal review is recommended before release. ([GNU][4])

### Alternative

Use Apache 2.0 or MIT when maximum adoption is more important than protection.

Limitation:

- Competitors can copy the core
- Companies can create competing hosted versions
- Commercial control is weaker

### Recommended Decision

Use **AGPLv3 plus a commercial licence** unless contributor adoption becomes
difficult.

> This repo is **AGPL-3.0-or-later** (see `LICENSE`).

---

## 9. Distribution Medium

### Free Version

Use:

- **GitHub repository** for source code
- **GitHub Releases** for Windows installers
- Documentation website
- GitHub Issues for bugs
- GitHub Discussions or Discord for community
- Chrome Web Store for the extension

GitHub Releases supports downloadable application builds and release notes.
Chrome Web Store publication provides a standard distribution route for Chrome
extensions. ([GitHub Docs][5])

### Paid Version

Use:

- Official product website
- Web account dashboard
- Stripe or Lemon Squeezy checkout
- Licence server
- Customer portal
- Email onboarding
- Private update channel

### Payment Recommendation

#### Start With Lemon Squeezy

Suitable for:

- International software sales
- Licence keys
- Subscription management
- Tax and VAT handling
- Refund and chargeback administration

Lemon Squeezy operates as merchant of record and handles payment, tax, VAT,
refunds, chargebacks and compliance responsibilities. ([docs.lemonsqueezy.com][6])

#### Move to Stripe Later

Stripe is available in Malaysia and supports recurring SaaS subscriptions,
customer portals, invoices and usage-based billing. ([Stripe][7])

### Recommended Initial Stack

```text
Source Code: GitHub
Free Installer: GitHub Releases
Extension: Chrome Web Store
Website: Next.js or WordPress
Payment: Lemon Squeezy
Licence: Lemon Squeezy Licence API
Authentication: Supabase
Cloud Database: Supabase
Application Hosting: Vercel
Community: GitHub Discussions
Support: Email and Discord
```

---

## 10. Other Revenue Sources

### Sponsorship

Enable GitHub Sponsors for users who want to support development. GitHub
Sponsors allows individuals and organizations to fund open-source maintainers
directly. ([GitHub Docs][8])

### Paid Setup Service

Charge RM99–RM299 for:

- Installation
- Profile setup
- CV import
- AI configuration
- Browser connection
- One-to-one onboarding

### Custom Integration

Charge businesses for:

- Custom ATS integration
- Private MCP tools
- Internal career portal integration
- White-label desktop applications
- Custom reporting

### Enterprise Deployment

Charge:

- Setup fee
- Annual licence
- Maintenance fee
- Support contract

### Affiliate Revenue

Potential partnerships:

- CV-writing services
- Interview coaching
- Online learning
- Certification platforms
- Career consultation

Affiliate relationships must be disclosed clearly.

---

## 11. Major Limitations

### Website Restrictions

LinkedIn prohibits third-party software and browser extensions that automate
activity on its website. Indeed's terms prohibit external bots or scripting
that automate Indeed Apply outside approved tools. ([LinkedIn][9])

**Strategy:**

- Do not promise LinkedIn or Indeed automated submission
- Provide job analysis and application preparation
- Let users complete restricted-platform actions manually
- Focus automation on permitted company career pages
- Seek official partnerships or APIs later

### CAPTCHA and Login Verification

The system cannot safely guarantee:

- CAPTCHA completion
- Two-factor authentication
- Login recovery
- Anti-bot checks

**Strategy:** Pause and request manual action.

### Website Layout Changes

Career websites regularly change forms and selectors.

**Strategy:**

- Create modular site adapters
- Add form-confidence scoring
- Maintain remote adapter updates
- Make adapter maintenance a Pro benefit

### AI Errors

AI may create inaccurate answers.

**Strategy:**

- Use only verified profile data
- Show answer sources
- Require approval for sensitive fields
- Block unsupported claims
- Maintain an audit trail

### Open-Source Competition

Others may fork or copy the project.

**Strategy:**

- Build a trusted brand
- Release improvements frequently
- Keep paid value service-based
- Build community early
- Offer better maintenance and support
- Use trademark protection for the product name

### Privacy Risk

The system handles:

- CVs
- Addresses
- Employment history
- Salary expectations
- Identity information

**Strategy:**

- Local-first storage
- Encryption
- Minimum cloud collection
- Clear consent
- Data export and deletion
- Independent security review

---

## 12. Launch Strategy

### Stage 1: Community Validation

- Release free local core
- Support manual job import
- Provide safe autofill
- Require approval before submission
- Collect GitHub feedback

### Stage 2: Paid Beta

Launch Pro with:

- AI CV tailoring
- Cover letters
- Cloud backup
- Two-device synchronization
- Premium adapters
- Application analytics

Target the first 50 paying users.

### Stage 3: Public Subscription

- Publish official website
- Add annual pricing
- Add referral programme
- Add AI-credit top-ups
- Publish tutorials and case studies

### Stage 4: Business Expansion

- Career-coach plan
- University plan
- Recruitment consultancy plan
- White-label deployment
- Enterprise support

---

## 13. Example Revenue Target

| Revenue Source    | Customers | Price | Monthly Revenue |
| ----------------- | --------: | ----: | --------------: |
| Pro               |       100 |  RM39 |         RM3,900 |
| Pro Plus          |        30 |  RM79 |         RM2,370 |
| Business          |        10 | RM299 |         RM2,990 |
| Setup services    |        10 | RM149 |         RM1,490 |
| AI-credit sales   |         — |     — |         RM1,000 |
| **Example total** |           |       |    **RM11,750** |

This is an illustrative target, not a profit guarantee. Hosting, AI, payment,
support and tax costs must be deducted.

---

## 14. Final Recommendation

Build the business around:

1. **Free open-source local core**
2. **Paid AI processing**
3. **Paid cloud synchronization**
4. **Paid maintained website adapters**
5. **Paid application analytics**
6. **Paid business deployment**
7. **Paid support and installation**

### Best Medium

```text
GitHub
   ↓
Free Local Application
   ↓
Official Website
   ↓
Lemon Squeezy Checkout
   ↓
Licence Key and User Account
   ↓
Paid Cloud Features
```

The free edition creates adoption and trust. The paid edition sells
convenience, continuous maintenance, hosted intelligence and professional
support.

The strongest launch combination is **GitHub + Chrome Web Store + Lemon
Squeezy + Supabase + Vercel**.

---

[1]: https://modelcontextprotocol.io/docs/getting-started/intro
[2]: https://opensource.org/osd
[3]: https://docs.lemonsqueezy.com/help/licensing/generating-license-keys
[4]: https://www.gnu.org/licenses/gpl-faq.en.html
[5]: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
[6]: https://docs.lemonsqueezy.com/help/marketplace
[7]: https://stripe.com/global
[8]: https://docs.github.com/en/sponsors
[9]: https://www.linkedin.com/help/linkedin/answer/a1340567