import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import ActivityTimeline from "@/components/ActivityTimeline"
import { getStageStatus } from "@/lib/stageVelocity"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !lead) {
    return notFound()
  }

  const velocity = getStageStatus(lead.stage_changed_at)

  const velocityColor =
    velocity === "green"
      ? "text-green-400"
      : velocity === "yellow"
      ? "text-yellow-400"
      : "text-red-400"

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">
          {lead.name}
        </h1>
        <div className="text-zinc-400 mt-2">
          {lead.brand_name || "No brand"}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Platform
            </div>
            <div>{lead.platform}</div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Subscribers
            </div>
            <div>
              {lead.subscriber_count
                ? lead.subscriber_count.toLocaleString()
                : "-"}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Deal Value
            </div>
            <div>
              ₹{" "}
              {lead.value
                ? Number(lead.value).toLocaleString()
                : "-"}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Score
            </div>
            <div>🔥 {lead.score || 0}/10</div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Status
            </div>
            <div>{lead.status}</div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Stage Velocity
            </div>
            <div className={velocityColor}>
              {velocity.toUpperCase()}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Follow Up Date
            </div>
            <div>
              {lead.follow_up_date || "None"}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase">
              Converted
            </div>
            <div>
              {lead.converted ? "Yes" : "No"}
            </div>
          </div>
        </div>
      </div>

      {/* 🧠 Activity Timeline */}
      <ActivityTimeline
        entityType="lead"
        entityId={lead.id}
      />
    </div>
  )
}
