import { supabase } from "@/lib/supabase"
import { calculatePipelineHealth } from "./pipelineHealthEngine"

export async function runPipelineHealthSnapshot() {
  const todayStr = new Date()
    .toISOString()
    .split("T")[0]

  const { data: existing } = await supabase
    .from("pipeline_health_snapshots")
    .select("id")
    .eq("snapshot_date", todayStr)
    .maybeSingle()

  if (existing) return

  const health = await calculatePipelineHealth()

  await supabase
    .from("pipeline_health_snapshots")
    .insert({
      score: health.score,
      snapshot_date: todayStr,
    })
}
