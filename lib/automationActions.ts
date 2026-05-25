import { supabase } from "@/lib/supabase"

export async function resolveAutomation(id: string) {
  await supabase
    .from("automations_log")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
}
