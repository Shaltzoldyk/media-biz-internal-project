"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useCurrency } from "@/context/CurrencyContext"

type Activity = {
  id: string
  entity_type: "lead" | "client"
  entity_id: string
  type: string
  message?: string | null
  severity?: "warning" | "high" | "critical" | null
  metadata: any
  created_at: string
}

/* ================================
   HELPERS
================================ */

function formatActivity(activity: Activity, fmt: (n: number | null | undefined) => string) {
  // 🔥 If message exists (system_flag or future intelligent logs)
  if (activity.message) {
    return activity.message
  }

  const meta = activity.metadata || {}

  switch (activity.type) {
    case "lead_created":
      return `Lead created — ${meta.name || ""}`

    case "status_change":
      return `Status changed from "${meta.from}" to "${meta.to}"`

    case "follow_up":
      return `Follow-up updated → ${meta.newFollowUpDate || ""}`

    case "conversion":
      return activity.entity_type === "lead"
        ? "Lead converted to client"
        : "Client created from lead"

    case "contract_update":
      return `Contract updated → ${fmt(meta.newValue)} (${meta.newBilling || ""})`

    case "payment_logged":
      return `Payment logged → ${fmt(meta.amount)}`

    case "payment_deleted":
      return `Payment deleted → ${fmt(meta.amount)}`

    case "client_deleted":
      return `Client deleted — ${meta.name || ""}`

    case "note":
      if (meta.action === "lead_deleted") {
        return `Lead deleted — ${meta.name || ""}`
      }
      return "Note recorded"

    default:
      return activity.type.replaceAll("_", " ")
  }
}

function severityStyle(severity: Activity["severity"]): React.CSSProperties {
  switch (severity) {
    case "critical": return { background: "var(--red-dim)",    border: "1px solid var(--red)" }
    case "high":     return { background: "var(--amber-dim)",  border: "1px solid var(--amber)" }
    case "warning":  return { background: "var(--amber-dim)",  border: "1px solid var(--amber)" }
    default:         return { background: "var(--bg-1)",        border: "1px solid var(--border)" }
  }
}

/* ================================
   COMPONENT
================================ */

export default function ActivityPage() {
  const { fmt } = useCurrency()
  const [activities, setActivities]     = useState<Activity[]>([])
  const [entityFilter, setEntityFilter] = useState("")
  const [typeFilter,   setTypeFilter]   = useState("")
  const [search,       setSearch]       = useState("")

  const fetchActivities = async () => {
    let query = supabase
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)

    if (entityFilter) query = query.eq("entity_type", entityFilter)
    if (typeFilter)   query = query.eq("type", typeFilter)

    const { data } = await query
    setActivities(data || [])
  }

  useEffect(() => { fetchActivities() }, [entityFilter, typeFilter])

  const filtered = activities.filter((a) => {
    if (!search) return true
    const lower = search.toLowerCase()
    return (
      a.entity_id.toLowerCase().includes(lower) ||
      formatActivity(a, fmt).toLowerCase().includes(lower)
    )
  })

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Log</div>
        <h1>Activity</h1>
      </div>

      {/* Filters */}
      <div className="fade-up delay-1" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ width: 140 }}>
          <option value="">All entities</option>
          <option value="lead">Lead</option>
          <option value="client">Client</option>
        </select>
        <input
          placeholder="Filter by type…"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: 160 }}
        />
        <input
          placeholder="Search activity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
      </div>

      {/* Feed */}
      <div className="fade-up delay-2" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((activity) => {
          const entityLink = activity.entity_type === "lead"
            ? `/leads/${activity.entity_id}`
            : `/clients/${activity.entity_id}`

          return (
            <div
              key={activity.id}
              style={{
                ...severityStyle(activity.severity),
                borderRadius: "var(--radius)",
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text)" }}>
                  {formatActivity(activity, fmt)}
                </div>
                <div className="mono" style={{ fontSize: "0.72rem", color: "var(--text-3)", flexShrink: 0 }}>
                  {new Date(activity.created_at).toLocaleString("en-IN", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: "0.72rem" }}>
                <Link href={entityLink} style={{ color: "var(--accent)" }}>
                  View {activity.entity_type}
                </Link>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ color: "var(--text-3)", fontSize: "0.875rem", padding: "32px 0", textAlign: "center" }}>
            No activity found.
          </div>
        )}
      </div>
    </div>
  )
}