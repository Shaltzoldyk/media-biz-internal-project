import { supabase } from "@/lib/supabase"
import { Lead } from "@/types/lead"
import {
  detectStuckLeads,
  detectOverdueFollowUps,
  detectAtRiskClients,
  calculateSystemHealth,
} from "@/lib/intelligence"

// Live data — do not pre-render at build time.
export const dynamic = "force-dynamic"

export default async function TodayPage() {
  const todayStr = new Date()
    .toISOString()
    .split("T")[0]

  const { data: leadsData } =
    await supabase.from("leads").select("*")

  const { data: clientsData } =
    await supabase.from("clients").select("*")

  const { data: revenueData } =
    await supabase
      .from("revenue_records")
      .select("*")

  const { data: snapshots } =
    await supabase
      .from("system_health_snapshots")
      .select("*")
      .order("snapshot_date", {
        ascending: true,
      })
      .limit(7)

  const leads =
    (leadsData || []) as Lead[]

  const stuckLeads =
    detectStuckLeads(leads, 5)

  const overdueFollowUps =
    detectOverdueFollowUps(leads)

  const atRiskClients =
    detectAtRiskClients(
      clientsData || [],
      revenueData || []
    )

  const systemHealth =
    calculateSystemHealth(
      stuckLeads,
      overdueFollowUps,
      atRiskClients
    )

  const previousScore =
    snapshots && snapshots.length > 1
      ? snapshots[snapshots.length - 2]
          ?.score
      : null

  const dueToday = leads.filter(
    (lead) =>
      lead.follow_up_date === todayStr
  )

  const highPriority = leads.filter(
    (lead) =>
      (lead.score || 0) >= 7 &&
      lead.status === "New"
  )

  return (
    <div className="space-y-12">
      <h1 className="text-3xl font-semibold">
        Today
      </h1>

      <SystemHealthCard
        score={systemHealth.score}
        breakdown={systemHealth.breakdown}
        previousScore={previousScore}
        snapshots={snapshots || []}
      />

      <ClientRiskSection
        title="💰 At-Risk Clients"
        clients={atRiskClients}
      />

      <OverdueSection
        title="🔴 Overdue Follow Ups"
        items={overdueFollowUps}
      />

      <Section title="📅 Follow Ups Today">
        {dueToday}
      </Section>

      <StuckSection
        title="🔥 Stuck Leads (5+ days)"
        stuck={stuckLeads}
      />

      <Section title="🚀 High Priority (Score 7+)">
        {highPriority}
      </Section>
    </div>
  )
}

/* ================================
   SYSTEM HEALTH CARD + TREND
================================ */

function SystemHealthCard({
  score,
  breakdown,
  previousScore,
  snapshots,
}: {
  score: number
  breakdown: {
    stuckPenalty: number
    overduePenalty: number
    revenuePenalty: number
  }
  previousScore: number | null
  snapshots: any[]
}) {
  const getColor = () => {
    if (score >= 90)
      return "bg-green-950 border-green-800 text-green-400"
    if (score >= 70)
      return "bg-yellow-950 border-yellow-800 text-yellow-400"
    return "bg-red-950 border-red-800 text-red-400"
  }

  const getTrend = () => {
    if (previousScore === null)
      return null
    if (score > previousScore)
      return "↑ Improving"
    if (score < previousScore)
      return "↓ Declining"
    return "→ Stable"
  }

  return (
    <div
      className={`border p-6 rounded-xl ${getColor()}`}
    >
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm uppercase tracking-wide">
            System Health
          </div>
          <div className="text-4xl font-bold mt-2">
            {score}/100
          </div>
          {getTrend() && (
            <div className="text-sm mt-2">
              {getTrend()}
            </div>
          )}
        </div>

        <div className="text-sm text-zinc-300 space-y-1">
          <div>
            Pipeline Risk:{" "}
            {breakdown.stuckPenalty}
          </div>
          <div>
            Follow-up Risk:{" "}
            {breakdown.overduePenalty}
          </div>
          <div>
            Revenue Risk:{" "}
            {breakdown.revenuePenalty}
          </div>
        </div>
      </div>

      {/* Mini 7-day bar strip */}
      {snapshots.length > 0 && (
        <div className="flex gap-2 mt-6 items-end">
          {snapshots.map(
            (snap, idx) => (
              <div
                key={idx}
                className="flex-1 bg-zinc-800 rounded"
                style={{
                  height: `${
                    snap.score
                  }%`,
                  minHeight: "10px",
                }}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

/* Remaining sections unchanged */

function ClientRiskSection({
  title,
  clients,
}: any) {
  if (!clients.length)
    return <EmptyState title={title} />

  const getStyles = (s: string) =>
    s === "critical"
      ? "bg-red-950 border-red-800 text-red-400"
      : s === "high"
      ? "bg-yellow-950 border-yellow-800 text-yellow-400"
      : "bg-orange-950 border-orange-800 text-orange-400"

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {title}
      </h2>
      <div className="grid gap-3">
        {clients.map((c: any) => (
          <div
            key={c.clientId}
            className={`border p-4 rounded-lg ${getStyles(
              c.severity
            )}`}
          >
            <div className="flex justify-between">
              <div className="font-medium text-white">
                {c.name}
              </div>
              <div className="text-sm">
                {c.daysOverdue} days overdue
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: any) {
  if (!children.length)
    return <EmptyState title={title} />

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {title}
      </h2>
      <div className="grid gap-3">
        {children.map((lead: any) => (
          <LeadCard
            key={lead.id}
            name={lead.name}
            stage={lead.status}
            value={lead.value}
          />
        ))}
      </div>
    </div>
  )
}

function OverdueSection({
  title,
  items,
}: any) {
  if (!items.length)
    return <EmptyState title={title} />

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {title}
      </h2>
      <div className="grid gap-3">
        {items.map((l: any) => (
          <div
            key={l.leadId}
            className="bg-red-950 border border-red-800 p-4 rounded-lg"
          >
            <div className="flex justify-between">
              <div className="font-medium">
                {l.name}
              </div>
              <div className="text-sm text-red-400">
                {l.overdueDays} days overdue
              </div>
            </div>
            <div className="text-sm text-zinc-400">
              {l.stage}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StuckSection({
  title,
  stuck,
}: any) {
  if (!stuck.length)
    return <EmptyState title={title} />

  const getStyles = (s: string) =>
    s === "critical"
      ? "bg-red-950 border-red-800 text-red-400"
      : s === "high"
      ? "bg-yellow-950 border-yellow-800 text-yellow-400"
      : "bg-orange-950 border-orange-800 text-orange-400"

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {title}
      </h2>
      <div className="grid gap-3">
        {stuck.map((l: any) => (
          <div
            key={l.leadId}
            className={`border p-4 rounded-lg ${getStyles(
              l.severity
            )}`}
          >
            <div className="flex justify-between">
              <div className="font-medium text-white">
                {l.name}
              </div>
              <div className="text-sm">
                {l.daysInStage} days in stage
              </div>
            </div>
            <div className="text-sm text-zinc-400">
              {l.stage}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LeadCard({
  name,
  stage,
  value,
}: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
      <div className="flex justify-between">
        <div className="font-medium">
          {name}
        </div>
        <div className="text-sm">
          ₹{" "}
          {value
            ? Number(value).toLocaleString()
            : "-"}
        </div>
      </div>
      <div className="text-sm text-zinc-400">
        {stage}
      </div>
    </div>
  )
}

function EmptyState({
  title,
}: any) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {title}
      </h2>
      <div className="text-zinc-500">
        Nothing here.
      </div>
    </div>
  )
}