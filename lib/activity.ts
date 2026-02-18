import { supabase } from "./supabase"

type ActivityInput = {
  entityType: "lead" | "client"
  entityId: string
type:
  | "status_change"
  | "note"
  | "follow_up"
  | "conversion"
  | "contract_update"
  | "payment_logged"
  | "payment_deleted"
  | "lead_created"

  metadata?: Record<string, any>
}

export async function logActivity({
  entityType,
  entityId,
  type,
  metadata = {},
}: ActivityInput) {
  const { error } = await supabase.from("activities").insert([
    {
      entity_type: entityType,
      entity_id: entityId,
      type,
      metadata,
    },
  ])

  if (error) {
    console.error("Activity log error:", error)
  }
}
