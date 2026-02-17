"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { getStageStatus } from "@/lib/stageVelocity"
import { Lead } from "@/types/lead"


const statusOptions = [
  "New",
  "Qualified",
  "Contacted",
  "Responded",
  "Call Booked",
  "Client",
  "Lost",
]

export default function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)

  const updateStatus = async (id: string, newStatus: string) => {
    const timestamp = new Date().toISOString()

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === id
          ? { ...lead, status: newStatus, stage_changed_at: timestamp }
          : lead
      )
    )

    const { error } = await supabase
      .from("leads")
      .update({
        status: newStatus,
        stage_changed_at: timestamp,
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating status:", error)
    }
  }

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", id)

    if (error) {
      console.error("Error deleting lead:", error)
      return
    }

    setLeads((prev) => prev.filter((lead) => lead.id !== id))
  }

  if (!leads.length) {
    return (
      <div className="bg-zinc-900 text-white p-10 rounded-lg border border-zinc-800 text-center">
        No leads yet.
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 text-white rounded-lg overflow-hidden border border-zinc-800">
      <table className="w-full text-left">
        <thead className="bg-zinc-800 text-sm uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="p-4">Name</th>
            <th className="p-4">Brand</th>
            <th className="p-4">Platform</th>
            <th className="p-4">Subscribers</th>
            <th className="p-4">Value</th>
            <th className="p-4">Score</th>
            <th className="p-4">Status</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>

        <tbody>
          {leads.map((lead) => {
            const velocity = getStageStatus(lead.stage_changed_at)

            const velocityColor =
              velocity === "green"
                ? "bg-green-500"
                : velocity === "yellow"
                ? "bg-yellow-500"
                : "bg-red-500"

            return (
              <tr
                key={lead.id}
                className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
              >
                <td className="p-4 font-medium flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${velocityColor}`}
                  />
                  {lead.name}
                </td>

                <td className="p-4 text-zinc-400">
                  {lead.brand_name || "-"}
                </td>

                <td className="p-4">{lead.platform || "-"}</td>

                <td className="p-4">
                  {lead.subscriber_count
                    ? lead.subscriber_count.toLocaleString()
                    : "-"}
                </td>

                <td className="p-4">
                  ₹{" "}
                  {lead.value
                    ? Number(lead.value).toLocaleString()
                    : "-"}
                </td>

                <td className="p-4">
                  {lead.score !== null && lead.score !== undefined ? (
                    <span className="text-sm">🔥 {lead.score}/10</span>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="p-4">
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      updateStatus(lead.id, e.target.value)
                    }
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4">
                  <button
                    onClick={() => deleteLead(lead.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
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
