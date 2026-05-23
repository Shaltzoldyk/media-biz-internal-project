export type Lead = {
  id: string

  name: string
  brand_name: string | null
  platform: string | null
  subscriber_count: number | null

  status: string

  value: number | null
  score: number | null

  stage_changed_at: string
  follow_up_date?: string | null
  last_contacted_at?: string | null

  // Scoring signals — persisted so scores can be recalculated and displayed
  signal_warm_intro?: boolean | null
  signal_outsourcing?: boolean | null
  signal_uploads_weekly?: boolean | null
  signal_monetized?: boolean | null

  // 🔥 Phase 3 — Conversion fields
  converted?: boolean | null
  converted_at?: string | null
  client_id?: string | null
  stage_at_conversion?: string | null

  created_at: string
}