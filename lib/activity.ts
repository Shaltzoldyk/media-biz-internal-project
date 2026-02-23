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
   INTERNAL HELPERS
================================ */

function isValidUUID(id: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
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
  try {
    // 🔒 Hard guard against invalid UUID
    if (!entityId || !isValidUUID(entityId)) {
      console.warn("⚠️ Skipping activity log — invalid entityId:", entityId)
      return
    }

    const insertPayload: Record<string, any> = {
      entity_type: entityType,
      entity_id: entityId,
      type,
      metadata: metadata ?? {},
    }

    if (message) insertPayload.message = message
    if (severity) insertPayload.severity = severity

    const { error } = await supabase
      .from("activities")
      .insert(insertPayload)

    if (error) {
      console.error("❌ Activity insert failed:", error)
      return
    }

  } catch (err) {
    console.error("Unexpected activity logging failure:", err)
  }
}