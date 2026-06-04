import { supabase }      from "@/lib/supabase"
import { Lead }          from "@/types/lead"
import Link              from "next/link"
import DismissAlert      from "@/components/DismissAlert"

export const dynamic = "force-dynamic"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(date: string | null | undefined): number {
  if (!date) return 0
  return Math.floor(
    (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
  )
}

function fmtValue(value: number | null | undefined): string | null {
  if (!value) return null
  return "₹" + value.toLocaleString("en-IN")
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const todayStr = new Date().toISOString().split("T")[0]

  const [{ data: openAlerts }, { data: ld }, { data: snapshot }] =
    await Promise.all([
      supabase
        .from("automations_log")
        .select("id, type, entity_id, entity_type, severity, created_at, stage_name")
        .eq("resolved", false)
        .order("severity", { ascending: false }),

      // Added: value + stage_changed_at so alert rows can show deal size + days stalled
      supabase
        .from("leads")
        .select("id, name, status, score, value, follow_up_date, stage_changed_at"),

      supabase
        .from("system_health_snapshots")
        .select("score")
        .eq("snapshot_date", todayStr)
        .limit(1)
        .maybeSingle(),
    ])

  const leads  = (ld || []) as Lead[]
  const alerts = openAlerts || []

  const healthScore = snapshot?.score ?? Math.max(0, 100 - alerts.length * 4)

  const scoreColor =
    healthScore >= 75 ? "var(--green)"
    : healthScore >= 50 ? "var(--amber)" : "var(--red)"

  const stalledAlerts    = alerts.filter((a) => a.type === "stalled_high_value_lead")
  const revenueAlerts    = alerts.filter((a) => a.type === "revenue_drop")
  const bottleneckAlerts = alerts.filter((a) => a.type === "stage_bottleneck")
  const outreachAlerts   = alerts.filter((a) => a.type === "outreach_not_sent")

  const dueToday = leads.filter((l) => l.follow_up_date === todayStr)
  const hot      = leads.filter((l) => (l.score || 0) >= 7 && l.status === "New")
  const leadMap  = new Map(leads.map((l) => [l.id, l]))

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </div>
        <h1>Today</h1>
      </div>

      {/* Stats */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28,
      }}>
        {[
          { label: "Health score", val: healthScore,     color: scoreColor },
          { label: "Due today",    val: dueToday.length, color: dueToday.length > 0 ? "var(--amber)" : "var(--text)" },
          { label: "Hot leads",    val: hot.length,      color: hot.length > 0 ? "var(--amber)" : "var(--text)" },
          { label: "Open alerts",  val: alerts.length,   color: alerts.length > 0 ? "var(--red)" : "var(--green)" },
        ].map((s) => (
          <div key={s.label} className="card stat">
            <div className="label">{s.label}</div>
            <div className="val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Feed grid */}
      <div className="fade-up delay-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Due today — no dismiss needed, just a link */}
        <Feed label="Due today" empty="Nothing due today."
          items={dueToday.map((l) => ({
            id:    l.id,
            href:  `/leads/${l.id}`,
            title: l.name,
            sub:   [l.status, l.score != null ? `score ${l.score}/10` : null].filter(Boolean).join(" · "),
            dot:   "dot-amber",
          }))} />

        {/* Hot leads — no dismiss needed */}
        <Feed label="High priority (score ≥ 7)" empty="No high-priority new leads."
          items={hot.map((l) => ({
            id:    l.id,
            href:  `/leads/${l.id}`,
            title: l.name,
            sub:   `score ${l.score}/10`,
            dot:   "dot-green",
          }))} />

        {/* ── Stalled high-value leads — actionable ── */}
        <AlertSection
          label="Stalled high-value leads"
          empty="No stalled high-value leads."
          items={stalledAlerts.map((a) => {
            const lead   = a.entity_id ? leadMap.get(a.entity_id) : undefined
            const days   = lead ? daysAgo(lead.stage_changed_at) : null
            const value  = lead ? fmtValue(lead.value) : null

            const sub = [
              value,
              days != null ? `${days}d in ${lead?.status ?? "stage"}` : null,
            ].filter(Boolean).join(" · ")

            return {
              id:       a.id,
              href:     lead ? `/leads/${a.entity_id}` : "#",
              title:    lead?.name ?? a.entity_id ?? "Unknown lead",
              sub,
              severity: a.severity,
              dot:      a.severity === "critical" ? "dot-red" : "dot-amber",
            }
          })}
        />

        {/* Pipeline bottlenecks — system-level, no per-lead context */}
        <Feed label="Pipeline bottlenecks" empty="No stage bottlenecks detected."
          items={bottleneckAlerts.map((a) => ({
            id:    a.id,
            href:  "/pipeline",
            title: a.stage_name ? `Stage: ${a.stage_name}` : "Pipeline stage",
            sub:   "low conversion rate",
            dot:   "dot-amber",
          }))} />

        {/* ── Outreach due — actionable ── */}
        <AlertSection
          label="Outreach due"
          empty="No outreach alerts."
          items={outreachAlerts.map((a) => {
            const lead = a.entity_id ? leadMap.get(a.entity_id) : undefined
            const days = lead ? daysAgo(lead.stage_changed_at) : null

            return {
              id:       a.id,
              href:     lead ? `/leads/${a.entity_id}` : "/outreach",
              title:    lead?.name ?? "Unknown lead",
              sub:      days != null ? `no email sent · ${days}d in Outreach` : "no email sent",
              severity: a.severity,
              dot:      "dot-amber",
            }
          })}
        />

        {/* Revenue alerts — system-level */}
        {revenueAlerts.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Feed label="Revenue alerts" empty=""
              items={revenueAlerts.map((a) => ({
                id:    a.id,
                href:  "/analytics",
                title: "Revenue drop detected",
                sub:   "see analytics for detail",
                dot:   a.severity === "critical" ? "dot-red" : "dot-amber",
              }))} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Feed — read-only list, no dismiss ───────────────────────────────────────

function Feed({ label, items, empty }: {
  label: string
  empty: string
  items: { id: string; href: string; title: string; sub: string; dot: string }[]
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="card" style={{ overflow: "hidden" }}>
        {items.length === 0
          ? <div style={{ padding: "16px", color: "var(--text-3)", fontSize: "0.83rem" }}>{empty}</div>
          : items.map((item, i) => (
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
            </Link>
          ))}
      </div>
    </div>
  )
}

// ─── AlertSection — actionable list with inline Dismiss ──────────────────────
// Used for stalled leads and outreach alerts where you need:
//   • deal value + days visible at a glance
//   • dismiss without leaving the page

function AlertSection({ label, items, empty }: {
  label: string
  empty: string
  items: {
    id:       string
    href:     string
    title:    string
    sub:      string
    severity?: string | null
    dot:      string
  }[]
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="card" style={{ overflow: "hidden" }}>
        {items.length === 0
          ? <div style={{ padding: "16px", color: "var(--text-3)", fontSize: "0.83rem" }}>{empty}</div>
          : items.map((item, i) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
            }}>
              <span className={`dot ${item.dot}`} />

              {/* Linked area — goes to the lead */}
              <Link href={item.href} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: 1 }}>
                  {item.sub}
                </div>
              </Link>

              {/* Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {item.severity && (
                  <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                    {item.severity}
                  </span>
                )}
                <DismissAlert id={item.id} />
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}