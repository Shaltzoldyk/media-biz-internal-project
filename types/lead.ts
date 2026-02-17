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

  created_at?: string
}
