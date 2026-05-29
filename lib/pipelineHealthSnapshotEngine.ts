// lib/pipelineHealthSnapshotEngine.ts
//
// Writes a daily pipeline health snapshot to pipeline_health_snapshots.
// Server-only — uses supabaseServer (service role) for the DB write.
// Called by intelligenceRunner (inside runIntelligenceChecks) so the
// cron handles it automatically each cycle.

import { supabaseServer as supabase } from "@/lib/supabaseServer"
import { calculatePipelineHealth } from "./pipelineHealthEngine"

export async function runPipelineHealthSnapshot() {
  const todayStr = new Date().toISOString().split("T")[0]

  const { data: existing } = await supabase
    .from("pipeline_health_snapshots")
    .select("id")
    .eq("snapshot_date", todayStr)
    .maybeSingle()

  // Already written today — skip
  if (existing) return

  const health = await calculatePipelineHealth()

  await supabase
    .from("pipeline_health_snapshots")
    .insert({
      score:         health.score,
      snapshot_date: todayStr,
    })
}