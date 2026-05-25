import { supabase } from "@/lib/supabase"
import { logActivity } from "@/lib/activity"

export async function convertLeadToClient(leadId: string) {
  // 1️⃣ Fetch Lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single()

  if (leadError || !lead) {
    throw new Error("Lead not found")
  }

  if (lead.converted) {
    throw new Error("Lead already converted")
  }

  // 2️⃣ Create Client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      lead_id: lead.id,
      name: lead.name,
      company: lead.brand_name,
      contract_value: lead.value,
      billing_type: "monthly",
      start_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single()

  if (clientError || !client) {
    throw new Error(clientError?.message || "Failed to create client")
  }

  // 3️⃣ Update Lead as Converted
  // stage_at_conversion records which pipeline stage this lead was in at the
  // moment of conversion. This is the correct input for the self-learning
  // probability engine — not the lead's current status, which never changes
  // after conversion and so tells you nothing about where in the funnel
  // the deal was won.
  const conversionTimestamp = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      converted: true,
      converted_at: conversionTimestamp,
      client_id: client.id,
      stage_at_conversion: lead.status,
    })
    .eq("id", lead.id)

  if (updateError) {
    // Lead update failed — delete the client we just created so we don't
    // leave an orphaned row. Re-attempting conversion would otherwise create
    // a duplicate client (step 2 has no duplicate guard).
    await supabase.from("clients").delete().eq("id", client.id)
    throw new Error(updateError.message)
  }

  // 4️⃣ 🔥 ACTIVITY LOGGING (Phase 4)

  // Log on lead
  await logActivity({
    entityType: "lead",
    entityId: lead.id,
    type: "conversion",
    metadata: {
      convertedToClientId: client.id,
      contractValue: lead.value,
      billingType: "monthly",
    },
  })

  // Log on client
  await logActivity({
    entityType: "client",
    entityId: client.id,
    type: "conversion",
    metadata: {
      fromLeadId: lead.id,
      originalLeadStatus: lead.status,
    },
  })

  return client
}
