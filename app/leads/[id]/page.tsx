import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import ActivityTimeline from "@/components/ActivityTimeline"
import { getStageStatus } from "@/lib/stageVelocity"
import { calculateLeadScore } from "@/lib/leadScore"
import RecalculateScoreButton from "@/components/RecalculateScoreButton"

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

  const signals = [
    { label: "Warm intro / referral",         value: lead.signal_warm_intro,       points: 3 },
    { label: "Already outsourcing production", value: lead.signal_outsourcing,      points: 3 },
    { label: "Uploads weekly or more",         value: lead.signal_uploads_weekly,   points: 2 },
    { label: "Monetized channel",              value: lead.signal_monetized,        points: 2 },
    { label: "100k+ subscribers",              value: (lead.subscriber_count ?? 0) >= 100000, points: 2, derived: true },
  ]

  const signalsKnown = lead.signal_warm_intro != null

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
            <div className="text-xs text-zinc-500 uppercase mb-1">
              Score
            </div>
            <div className="flex items-center gap-3">
              <span>🔥 {lead.score || 0}/10</span>
              {signalsKnown && (
                <RecalculateScoreButton leadId={lead.id} lead={lead} />
              )}
            </div>
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

      {/* Scoring signals breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="text-xs text-zinc-500 uppercase mb-3">Scoring signals</div>
        {!signalsKnown ? (
          <div className="text-sm text-zinc-500">
            Signals not recorded — this lead was created before signal tracking was added.
          </div>
        ) : (
          <div className="space-y-2">
            {signals.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <span className={s.value ? "text-zinc-200" : "text-zinc-500"}>
                  {s.value ? "✓" : "✗"} {s.label}
                </span>
                <span className={`text-xs font-mono ${s.value ? "text-green-400" : "text-zinc-600"}`}>
                  {s.value ? `+${s.points}` : `+0`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🧠 Activity Timeline */}
      <ActivityTimeline
        entityType="lead"
        entityId={lead.id}
      />
    </div>
  )
}
