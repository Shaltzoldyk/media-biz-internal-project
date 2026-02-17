import { supabase } from "@/lib/supabase";

export async function convertLeadToClient(leadId: string) {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    throw new Error("Lead not found");
  }

  if (lead.converted) {
    throw new Error("Lead already converted");
  }

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
    .single();

  if (clientError || !client) {
    throw new Error(clientError?.message || "Failed to create client");
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      converted: true,
      converted_at: new Date().toISOString(),
      client_id: client.id,
    })
    .eq("id", lead.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return client;
}
