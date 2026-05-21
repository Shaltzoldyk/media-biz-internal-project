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

  // 🔥 Phase 3 — Conversion fields
  converted?: boolean | null
  converted_at?: string | null
  client_id?: string | null

  created_at: string
}