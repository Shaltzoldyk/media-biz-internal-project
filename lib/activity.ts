import { supabase } from "./supabase"

/* ================================
   ACTIVITY TYPES
================================ */

export type ActivityType =
  | "status_change"
  | "note"
  | "follow_up"
  | "conversion"
  | "contract_update"
  | "payment_logged"
  | "payment_deleted"
  | "lead_created"
  | "system_flag"

export type ActivitySeverity =
  | "warning"
  | "high"
  | "critical"

type ActivityInput = {
  entityType: "lead" | "client"
  entityId: string
  type: ActivityType
  message?: string
  severity?: ActivitySeverity
  metadata?: Record<string, any>
}

/* ================================
   LOG ACTIVITY
================================ */

export async function logActivity({
  entityType,
  entityId,
  type,
  message,
  severity,
  metadata = {},
}: ActivityInput) {
  const insertPayload: Record<string, any> = {
    entity_type: entityType,
    entity_id: entityId,
    type,
    metadata,
  }

  if (message) {
    insertPayload.message = message
  }

  if (severity) {
    insertPayload.severity = severity
  }

  const { error } = await supabase
    .from("activities")
    .insert([insertPayload])

  if (error) {
    console.error(
      "Activity log error:",
      error
    )
  }
}
