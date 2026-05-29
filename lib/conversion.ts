// lib/conversion.ts
//
// Converts a Lead into a Client.
//
// The three-step operation (create client + update lead + link IDs) is wrapped
// in a single Postgres transaction via the convert_lead_to_client() RPC function.
// If any step fails, the DB rolls back automatically — no orphaned client rows,
// no partial updates.
//
// Activity logging happens AFTER the transaction commits. It's intentionally
// outside the transaction: a failed activity log should not roll back a
// successful conversion, and the activity log is audit-only data.

import { supabaseServer as supabase } from "@/lib/supabaseServer"
import { logActivity } from "@/lib/activity"

export async function convertLeadToClient(leadId: string) {
  // Single atomic RPC — create client + update lead in one transaction.
  // The SQL function raises an exception if the lead is not found or
  // has already been converted, which surfaces here as a non-null error.
  const { data: client, error } = await supabase.rpc("convert_lead_to_client", {
    p_lead_id: leadId,
  })

  if (error) {
    // Postgres RAISE EXCEPTION messages come through in error.message
    throw new Error(error.message || "Conversion failed")
  }

  if (!client) {
    throw new Error("Conversion returned no client data")
  }

  // Activity logging — outside the transaction intentionally (see header note)
  await Promise.all([
    logActivity({
      entityType: "lead",
      entityId:   leadId,
      type:       "conversion",
      metadata: {
        convertedToClientId: client.id,
        contractValue:       client.contract_value,
        billingType:         client.billing_type,
      },
    }),
    logActivity({
      entityType: "client",
      entityId:   client.id,
      type:       "conversion",
      metadata: {
        fromLeadId:          leadId,
        originalLeadStatus:  client.stage_at_conversion,
      },
    }),
  ])

  return client
}