// lib/config.ts
// Single source of truth for all tuning parameters.
// Import only the group you need: import { PIPELINE } from "@/lib/config"

export const PIPELINE = {
  HIGH_VALUE_THRESHOLD:   5000,   // deals >= this get elevated stall monitoring
  STALLED_DAYS_THRESHOLD: 5,      // days in stage before stalled_high_value_lead alert
  STUCK_DAYS_THRESHOLD:   7,      // pipelineHealthEngine: days before counted as "stuck"
  ESCALATION_DAYS:        3,      // days before open alert escalates in severity
  MIN_STAGE_SAMPLE_SIZE:  5,      // min leads in stage for bottleneck detection
  AGING_RISK_THRESHOLD:   0.35,   // structuralRiskScore above which to fire aging_risk
  BOTTLENECK_THRESHOLD:   0.15,   // stage conversion rate below which to flag
}

export const LEADS = {
  STUCK_CRITICAL_DAYS:  15,
  STUCK_HIGH_DAYS:      10,
  MODERATE_RISK_DAYS:   14,   // leadAgingEngine: moderate aging bucket
  HIGH_RISK_DAYS:       21,   // leadAgingEngine: high aging bucket
}

export const OUTREACH = {
  STALL_DAYS: 3,   // days in Outreach stage with no email before flagging
}

export const CLIENTS = {
  OVERDUE_CRITICAL_DAYS: 15,
  OVERDUE_HIGH_DAYS:      7,
}