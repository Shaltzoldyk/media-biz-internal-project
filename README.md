# Media Business CRM

> A purpose-built CRM for a creator-led media business: replacing generic tools with something designed around how sponsorship pipelines, recurring client revenue, and brand outreach actually work.

**Status:** Work in progress · In active use  
**Philosophy:** Small software: purpose-built tools for small teams outperform generic platforms when the workflow is specific enough to justify it.

---

## Why This Exists

Off-the-shelf CRMs are built for sales teams. They assume a generic B2B pipeline: lead → demo → proposal → close. A media business running brand partnerships and recurring post-production clients doesn't map cleanly onto that. The stages are different, the signals that matter are different, and the revenue model (a mix of one-off sponsorships and monthly retainers) requires different alerting logic entirely.

This is a CRM built around the actual workflow, not adapted to fit one.

---

## What It Tracks

**Leads** — Inbound and outbound brand partnership prospects, scored on criteria specific to creator businesses: subscriber count, upload frequency, whether they're already outsourcing production, warm vs cold intro. Each lead moves through a custom pipeline with stage timestamps, follow-up dates, and last-contacted tracking.

**Clients** — Converted leads with billing type (monthly retainer vs one-off), start date, and revenue history. The system distinguishes between active retainer clients and closed deals, and monitors each differently.

**Pipeline** — A Kanban board view of the full lead lifecycle, from first contact to closed/won or closed/lost.

**Revenue** — Daily revenue records tied to clients, used as the input for all forecasting and alerting logic.

**Activity Feed** — A unified log of system-generated flags, manual notes, and automated escalations across all entities.

---

## Intelligence Layer

The most non-obvious part of the codebase. Seven engines run analysis on top of the base data:

### Stuck Lead Detection
Flags leads that haven't changed stage in more than 5 days. Severity scales with time: warning at 5 days, high at 10, critical at 15. Terminal stages (closed won/lost, converted) are excluded from the check.

### Overdue Follow-Up Detection
Surfaces leads with a follow-up date that has passed and haven't been contacted. Skips terminal leads.

### At-Risk Client Detection
For monthly retainer clients, calculates the billing anniversary for the current month and checks whether a revenue record exists on or after that date. If not, the client is flagged as at-risk with severity proportional to how many days overdue the payment is.

### System Health Score
Aggregates all active flags into a single 0–100 score. Each flag carries a penalty weighted by severity and type — revenue risk carries double weight versus pipeline risk. The score gives a one-number read on how clean the business is running at any moment.

### Revenue Forecast Engine
Projects next-30-day revenue from a 30-day rolling average, then applies two adjustments:

- **Risk exposure** — the share of revenue attributable to at-risk clients is subtracted from the projection
- **Trend slope** — compares first-15-days vs last-15-days revenue within the window to detect acceleration or deceleration

Also outputs a **confidence score** (0–1) that discounts the projection based on revenue volatility and client concentration risk. A forecast built on one large client and erratic daily revenue gets a lower confidence score than one built on several stable clients.

### Adaptive Threshold Engine
Rather than using fixed alert thresholds, the revenue drop detector calculates a threshold based on the actual volatility of the business over the last 14 days. A business with naturally spiky revenue needs a wider band before a drop registers as anomalous. The threshold scales between 15% and 35% depending on measured volatility — it tightens as the business stabilises.

The same adaptive logic applies to pipeline stage conversion thresholds.

### Monte Carlo Forecast
Runs 1,000 simulations of pipeline outcomes. Each active lead has an estimated close probability; each simulation independently samples whether each lead closes. The output is a distribution: mean expected revenue, 10th percentile (pessimistic), 90th percentile (optimistic), and overall volatility. This gives a probabilistic revenue range rather than a single point estimate — more honest than a straight-line projection.

---

## Automation Engine

Runs as a background cycle with five jobs:

| Job | What It Does |
|---|---|
| Stalled high-value lead detection | Flags leads above £5,000 value that haven't moved in 5+ days |
| Revenue drop detection | Compares current vs previous 7-day windows against adaptive threshold |
| Stage bottleneck detection | Identifies pipeline stages with conversion rates below the adaptive threshold (minimum 5 leads in stage required) |
| Aging risk detection | Calculates structural aging risk score across the pipeline; threshold tightens as structural risk increases |
| Escalation engine | Promotes unresolved automations from high → critical after 3 days of inaction |

Each job checks for an existing unresolved record before inserting — no duplicate alerts. All flags write to a unified activity feed with severity, metadata, and timestamps.

---

## Lead Scoring

Leads are scored at creation on five signals specific to creator business partnerships:

| Signal | Weight |
|---|---|
| Subscriber count ≥ 100K | +2 |
| Already outsourcing production | +3 |
| Uploads weekly or more | +2 |
| Monetized channel | +2 |
| Warm introduction | +3 |

Maximum score: 10. Scoring is intentionally simple — the weights reflect which signals have historically indicated a higher close rate in this specific business context.

---

## Stack

```
Next.js 15 · React 19 · TypeScript · Supabase · PostgreSQL
Tailwind CSS · Radix UI
```

---

## Design Philosophy

Generic CRM tools solve for the average use case. The average use case is not this one.

The intelligence layer here exists because the questions that matter in a media business are specific: *Which brand deal has stalled and is about to go cold? Which retainer client hasn't paid this month? Is my pipeline actually healthy or is it full of deals that have been "in negotiation" for three weeks?* No off-the-shelf tool answers those questions without significant configuration overhead — and even then, not well.

Small software built around a specific workflow beats a large platform adapted to fit one.
