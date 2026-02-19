import { Lead } from "@/types/lead"

/* ================================
   SHARED CONFIG
================================ */

const TERMINAL_STAGES = ["closed_won", "closed_lost"]

function isTerminal(lead: Lead) {
  return (
    TERMINAL_STAGES.includes(lead.status) ||
    lead.converted === true
  )
}

function calculateDaysDifference(
  from: Date,
  to: Date
) {
  const diffMs =
    to.getTime() - from.getTime()

  return diffMs / (1000 * 60 * 60 * 24)
}

/* ================================
   SEVERITY TYPES
================================ */

export type StuckSeverity =
  | "warning"
  | "high"
  | "critical"

export type ClientRiskSeverity =
  | "warning"
  | "high"
  | "critical"

/* ================================
   STUCK LEAD DETECTION
================================ */

export type StuckLead = {
  leadId: string
  name: string
  stage: string
  daysInStage: number
  severity: StuckSeverity
}

function resolveStuckSeverity(
  days: number
): StuckSeverity {
  if (days >= 15) return "critical"
  if (days >= 10) return "high"
  return "warning"
}

export function detectStuckLeads(
  leads: Lead[],
  thresholdDays: number = 5
): StuckLead[] {
  const now = new Date()

  return leads
    .filter((lead) => {
      if (!lead.stage_changed_at) return false
      if (isTerminal(lead)) return false

      const updatedAt = new Date(
        lead.stage_changed_at
      )

      const diffDays =
        calculateDaysDifference(
          updatedAt,
          now
        )

      return diffDays >= thresholdDays
    })
    .map((lead) => {
      const updatedAt = new Date(
        lead.stage_changed_at
      )

      const diffDays =
        calculateDaysDifference(
          updatedAt,
          now
        )

      const daysInStage =
        Math.floor(diffDays)

      return {
        leadId: lead.id,
        name: lead.name,
        stage: lead.status,
        daysInStage,
        severity:
          resolveStuckSeverity(
            daysInStage
          ),
      }
    })
}

/* ================================
   OVERDUE FOLLOW-UP DETECTION
================================ */

export type OverdueFollowUp = {
  leadId: string
  name: string
  stage: string
  overdueDays: number
}

export function detectOverdueFollowUps(
  leads: Lead[]
): OverdueFollowUp[] {
  const today = new Date()

  return leads
    .filter((lead) => {
      if (!lead.follow_up_date) return false
      if (isTerminal(lead)) return false

      const followUp = new Date(
        lead.follow_up_date
      )

      return followUp < today
    })
    .map((lead) => {
      const followUp = new Date(
        lead.follow_up_date!
      )

      const diffDays =
        calculateDaysDifference(
          followUp,
          today
        )

      return {
        leadId: lead.id,
        name: lead.name,
        stage: lead.status,
        overdueDays:
          Math.floor(diffDays),
      }
    })
}

/* ================================
   AT-RISK CLIENT DETECTION
================================ */

export type AtRiskClient = {
  clientId: string
  name: string
  daysOverdue: number
  severity: ClientRiskSeverity
}

function resolveClientSeverity(
  days: number
): ClientRiskSeverity {
  if (days >= 15) return "critical"
  if (days >= 7) return "high"
  return "warning"
}

type Client = {
  id: string
  name: string
  billing_type: string | null
  start_date: string | null
  status: string | null
}

type RevenueRecord = {
  client_id: string
  revenue_date: string
}

export function detectAtRiskClients(
  clients: Client[],
  revenueRecords: RevenueRecord[]
): AtRiskClient[] {
  const today = new Date()

  return clients
    .filter((client) => {
      if (
        !client.billing_type ||
        client.billing_type !== "monthly"
      )
        return false

      if (!client.start_date) return false

      if (
        client.status &&
        client.status.toLowerCase() !==
          "active"
      )
        return false

      return true
    })
    .map((client) => {
      const start = new Date(
        client.start_date!
      )

      const monthsDiff =
        (today.getFullYear() -
          start.getFullYear()) *
          12 +
        (today.getMonth() -
          start.getMonth())

      const lastAnniversary =
        new Date(start)
      lastAnniversary.setMonth(
        start.getMonth() + monthsDiff
      )

      if (lastAnniversary > today) {
        lastAnniversary.setMonth(
          lastAnniversary.getMonth() - 1
        )
      }

      const hasPaid =
        revenueRecords.some(
          (r) =>
            r.client_id === client.id &&
            new Date(r.revenue_date) >=
              lastAnniversary
        )

      if (hasPaid) return null

      const daysOverdue = Math.floor(
        calculateDaysDifference(
          lastAnniversary,
          today
        )
      )

      if (daysOverdue <= 0) return null

      return {
        clientId: client.id,
        name: client.name,
        daysOverdue,
        severity:
          resolveClientSeverity(
            daysOverdue
          ),
      }
    })
    .filter(Boolean) as AtRiskClient[]
}

/* ================================
   SYSTEM HEALTH SCORE
================================ */

export type SystemHealth = {
  score: number
  breakdown: {
    stuckPenalty: number
    overduePenalty: number
    revenuePenalty: number
  }
}

function severityPenalty(
  severity: "warning" | "high" | "critical"
) {
  if (severity === "critical") return 10
  if (severity === "high") return 5
  return 2
}

export function calculateSystemHealth(
  stuckLeads: StuckLead[],
  overdueFollowUps: OverdueFollowUp[],
  atRiskClients: AtRiskClient[]
): SystemHealth {
  let stuckPenalty = 0
  let overduePenalty = 0
  let revenuePenalty = 0

  // Pipeline risk
  stuckLeads.forEach((lead) => {
    stuckPenalty += severityPenalty(
      lead.severity
    )
  })

  // Follow-up risk (fixed weight)
  overduePenalty +=
    overdueFollowUps.length * 3

  // Revenue risk (heavier weight)
  atRiskClients.forEach((client) => {
    revenuePenalty +=
      severityPenalty(
        client.severity
      ) * 2
  })

  const totalPenalty =
    stuckPenalty +
    overduePenalty +
    revenuePenalty

  const score = Math.max(
    0,
    100 - totalPenalty
  )

  return {
    score,
    breakdown: {
      stuckPenalty,
      overduePenalty,
      revenuePenalty,
    },
  }
}
