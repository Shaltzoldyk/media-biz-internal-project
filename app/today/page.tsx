import { supabase } from "@/lib/supabase"
import { Lead } from "@/types/lead"
import {
  detectStuckLeads, detectOverdueFollowUps,
  detectAtRiskClients, calculateSystemHealth,
} from "@/lib/intelligence"
import { getExchangeRate, fmtINR, fmtUSD } from "@/lib/currency"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function TodayPage() {
  const todayStr = new Date().toISOString().split("T")[0]
  const rate = await getExchangeRate()

  const [{ data: ld }, { data: cd }, { data: rd }, { data: snaps }] = await Promise.all([
    supabase.from("leads").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("revenue_records").select("*"),
    supabase.from("system_health_snapshots").select("*").order("snapshot_date", { ascending: true }).limit(7),
  ])

  const leads = (ld || []) as Lead[]
  const stuck       = detectStuckLeads(leads, 5)
  const overdue     = detectOverdueFollowUps(leads)
  const atRisk      = detectAtRiskClients(cd || [], rd || [])
  const health      = calculateSystemHealth(stuck, overdue, atRisk)
  const dueToday    = leads.filter((l) => l.follow_up_date === todayStr)
  const hot         = leads.filter((l) => (l.score || 0) >= 7 && l.status === "New")
  const totalAlerts = stuck.length + overdue.length + atRisk.length

  const scoreColor = health.score >= 75 ? "var(--green)" : health.score >= 50 ? "var(--amber)" : "var(--red)"

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
        <h1>Today</h1>
      </div>

      {/* Stats */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28,
      }}>
        {[
          { label: "Health score", val: health.score, color: scoreColor },
          { label: "Due today",    val: dueToday.length, color: dueToday.length > 0 ? "var(--amber)" : "var(--text)" },
          { label: "Hot leads",    val: hot.length, color: hot.length > 0 ? "var(--amber)" : "var(--text)" },
          { label: "Alerts",       val: totalAlerts, color: totalAlerts > 0 ? "var(--red)" : "var(--green)" },
        ].map((s) => (
          <div key={s.label} className="card stat">
            <div className="label">{s.label}</div>
            <div className="val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Feed grid */}
      <div className="fade-up delay-2" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
      }}>
        <Feed label="Due today" empty="Nothing due today." items={dueToday.map((l) => ({
          id: l.id, href: `/leads/${l.id}`, title: l.name, sub: l.status,
          right: l.value ? `${fmtINR(l.value)}  ·  ${fmtUSD(l.value, rate)}` : null,
          dot: "dot-amber",
        }))} />

        <Feed label="High priority (score ≥ 7)" empty="No high-priority new leads." items={hot.map((l) => ({
          id: l.id, href: `/leads/${l.id}`, title: l.name, sub: `score ${l.score}/10`,
          right: l.value ? `${fmtINR(l.value)}  ·  ${fmtUSD(l.value, rate)}` : null,
          dot: "dot-green",
        }))} />

        <Feed label="Stuck leads" empty="No stuck leads." items={stuck.map((l: any) => ({
          id: l.leadId, href: `/leads/${l.leadId}`, title: l.name,
          sub: `${l.daysInStage}d in ${l.stage}`,
          right: l.severity,
          dot: l.severity === "critical" ? "dot-red" : "dot-amber",
        }))} />

        <Feed label="Overdue follow-ups" empty="No overdue follow-ups." items={overdue.map((l: any) => ({
          id: l.leadId, href: `/leads/${l.leadId}`, title: l.name, sub: l.stage,
          right: `${l.overdueDays}d overdue`,
          dot: "dot-red",
        }))} />

        <div style={{ gridColumn: "1 / -1" }}>
          <Feed label="At-risk clients" empty="No at-risk clients." items={atRisk.map((c: any) => ({
            id: c.clientId, href: `/clients/${c.clientId}`, title: c.name,
            sub: `${c.daysOverdue}d overdue`,
            right: c.severity,
            dot: c.severity === "critical" ? "dot-red" : "dot-amber",
          }))} />
        </div>
      </div>
    </div>
  )
}

function Feed({ label, items, empty }: {
  label: string
  empty: string
  items: { id: string; href: string; title: string; sub: string; right: string | null; dot: string }[]
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="card" style={{ overflow: "hidden" }}>
        {items.length === 0 ? (
          <div style={{ padding: "16px 16px", color: "var(--text-3)", fontSize: "0.83rem" }}>{empty}</div>
        ) : items.map((item, i) => (
          <Link key={item.id} href={item.href} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            borderTop: i > 0 ? "1px solid var(--border)" : "none",
          }}>
            <span className={`dot ${item.dot}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 1 }}>{item.sub}</div>
            </div>
            {item.right && (
              <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-3)", flexShrink: 0 }}>
                {item.right}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}