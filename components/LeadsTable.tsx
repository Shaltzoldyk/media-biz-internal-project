"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { getStageStatus } from "@/lib/stageVelocity"
import { Lead } from "@/types/lead"
import { logActivity } from "@/lib/activity"
import { useCurrency } from "@/context/CurrencyContext"

const STATUS_OPTIONS = ["New","Qualified","Contacted","Responded","Call Booked","Client","Lost"]

export default function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads]         = useState<Lead[]>(initialLeads)
  const [editingDate, setEditing] = useState<string | null>(null)
  const { fmt, currency }         = useCurrency()

  const updateStatus = async (id: string, newStatus: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead || lead.status === newStatus) return
    const prev = lead.status
    const ts   = new Date().toISOString()
    const patch: Record<string, string> = { status: newStatus, stage_changed_at: ts }
    if (["Contacted","Responded","Call Booked"].includes(newStatus))
      patch.last_contacted_at = ts

    setLeads((p) => p.map((l) => l.id === id ? { ...l, ...patch } : l))
    const { error } = await supabase.from("leads").update(patch).eq("id", id)
    if (error) {
      setLeads((p) => p.map((l) => l.id === id ? { ...l, status: prev } : l))
      return
    }
    await logActivity({ entityType:"lead", entityId:id, type:"status_change", metadata:{ from:prev, to:newStatus } })
  }

  const updateFollowUp = async (id: string, date: string) => {
    setLeads((p) => p.map((l) => l.id === id ? { ...l, follow_up_date: date } : l))
    setEditing(null)
    await supabase.from("leads").update({ follow_up_date: date }).eq("id", id)
    await logActivity({ entityType:"lead", entityId:id, type:"follow_up_set", metadata:{ date } })
  }

  const deleteLead = async (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead || !confirm(`Delete ${lead.name}?`)) return
    setLeads((p) => p.filter((l) => l.id !== id))
    await supabase.from("leads").delete().eq("id", id)
    await logActivity({ entityType:"lead", entityId:id, type:"lead_deleted", metadata:{ name:lead.name } })
  }

  if (!leads.length) return (
    <div className="card" style={{ padding:"48px 20px", textAlign:"center", color:"var(--text-3)" }}>
      No leads yet.{" "}
      <Link href="/leads/new" style={{ color:"var(--accent)" }}>Add your first one →</Link>
    </div>
  )

  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Brand</th><th>Platform</th>
            <th>Subs</th>
            <th>Value ({currency === "INR" ? "₹" : "$"})</th>
            <th>Score</th><th>Status</th><th>Follow-up</th><th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const vel    = getStageStatus(lead.stage_changed_at)
            const dotCls = vel === "green" ? "dot dot-green" : vel === "yellow" ? "dot dot-amber" : "dot dot-red"

            return (
              <tr key={lead.id}>
                <td>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span className={dotCls} title={`Stage velocity: ${vel}`} />
                    <Link href={`/leads/${lead.id}`} style={{ fontWeight:500 }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--accent)")}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "inherit")}
                    >
                      {lead.name}
                    </Link>
                  </div>
                </td>

                <td style={{ color:"var(--text-2)" }}>
                  {lead.brand_name ?? <span style={{ color:"var(--text-3)" }}>—</span>}
                </td>

                <td>
                  {lead.platform
                    ? <span className="pill pill-gray">{lead.platform}</span>
                    : <span style={{ color:"var(--text-3)" }}>—</span>}
                </td>

                <td className="mono" style={{ color:"var(--text-2)" }}>
                  {lead.subscriber_count ? lead.subscriber_count.toLocaleString("en-IN") : "—"}
                </td>

                <td className="mono" style={{ fontSize:"0.82rem" }}>
                  {lead.value ? fmt(lead.value) : <span style={{ color:"var(--text-3)" }}>—</span>}
                </td>

                <td>
                  {lead.score != null ? (
                    <span className="mono" style={{
                      fontSize:"0.82rem",
                      color: lead.score >= 7 ? "var(--green)" : lead.score >= 4 ? "var(--amber)" : "var(--red)",
                    }}>
                      {lead.score}/10
                    </span>
                  ) : <span style={{ color:"var(--text-3)" }}>—</span>}
                </td>

                <td>
                  <select
                    value={lead.status}
                    onChange={(e) => updateStatus(lead.id, e.target.value)}
                    style={{ width:"auto", fontSize:"0.8rem", padding:"4px 8px" }}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>

                <td>
                  {editingDate === lead.id ? (
                    <input type="date"
                      defaultValue={lead.follow_up_date || ""}
                      autoFocus
                      style={{ width:130 }}
                      onBlur={(e) => updateFollowUp(lead.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateFollowUp(lead.id, (e.target as HTMLInputElement).value)
                        if (e.key === "Escape") setEditing(null)
                      }}
                    />
                  ) : (
                    <button onClick={() => setEditing(lead.id)}
                      className="btn btn-ghost"
                      style={{ padding:"2px 4px", fontSize:"0.78rem",
                        color: lead.follow_up_date ? "var(--text-2)" : "var(--text-3)" }}
                    >
                      {lead.follow_up_date || "Set date"}
                    </button>
                  )}
                </td>

                <td>
                  <button onClick={() => deleteLead(lead.id)}
                    className="btn btn-ghost btn-danger"
                    style={{ padding:"3px 8px", fontSize:"0.75rem" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}