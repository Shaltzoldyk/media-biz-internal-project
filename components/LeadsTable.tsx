"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { getStageStatus } from "@/lib/stageVelocity"
import { Lead } from "@/types/lead"
import { logActivity } from "@/lib/activity"

const statusOptions = [
  "New",
  "Qualified",
  "Contacted",
  "Responded",
  "Call Booked",
  "Client",
  "Lost",
]

export default function LeadsTable({
  initialLeads,
}: {
  initialLeads: Lead[]
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)

  const updateStatus = async (id: string, newStatus: string) => {
    if (!statusOptions.includes(newStatus)) return

    const lead = leads.find((l) => l.id === id)
    if (!lead || lead.status === newStatus) return

    const previousStatus = lead.status
    const timestamp = new Date().toISOString()

    const updatePayload: any = {
      status: newStatus,
      stage_changed_at: timestamp,
    }

    if (
      newStatus === "Contacted" ||
      newStatus === "Responded" ||
      newStatus === "Call Booked"
    ) {
      updatePayload.last_contacted_at = timestamp
    }

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              status: newStatus,
              stage_changed_at: timestamp,
              last_contacted_at:
                updatePayload.last_contacted_at ||
                lead.last_contacted_at,
            }
          : lead
      )
    )

    const { error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", id)

    if (error) {
      console.error("Error updating status:", error)

      // Rollback
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id
            ? { ...lead, status: previousStatus }
            : lead
        )
      )
      return
    }

    await logActivity({
      entityType: "lead",
      entityId: id,
      type: "status_change",
      metadata: {
        from: previousStatus,
        to: newStatus,
      },
    })
  }

  const updateFollowUp = async (id: string, date: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return

    const previousDate = lead.follow_up_date

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === id
          ? { ...lead, follow_up_date: date }
          : lead
      )
    )

    const { error } = await supabase
      .from("leads")
      .update({ follow_up_date: date })
      .eq("id", id)

    if (error) {
      console.error("Error updating follow-up date:", error)

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id
            ? { ...lead, follow_up_date: previousDate }
            : lead
        )
      )
      return
    }

    await logActivity({
      entityType: "lead",
      entityId: id,
      type: "follow_up",
      metadata: {
        previousFollowUpDate: previousDate,
        newFollowUpDate: date,
      },
    })
  }

  const deleteLead = async (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting lead:", error)
      return
    }

    setLeads((prev) =>
      prev.filter((lead) => lead.id !== id)
    )

    await logActivity({
      entityType: "lead",
      entityId: id,
      type: "note",
      metadata: {
        action: "lead_deleted",
        name: lead.name,
        finalStatus: lead.status,
      },
    })
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
            <th className="p-4">Follow Up</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>

        <tbody>
          {leads.map((lead) => {
            const velocity = getStageStatus(
              lead.stage_changed_at
            )

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
                {/* Name + Velocity + Link */}
                <td className="p-4 font-medium flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${velocityColor}`}
                  />
                  <Link
                    href={`/leads/${lead.id}`}
                    className="hover:underline"
                  >
                    {lead.name}
                  </Link>
                </td>

                <td className="p-4 text-zinc-400">
                  {lead.brand_name || "-"}
                </td>

                <td className="p-4">
                  {lead.platform || "-"}
                </td>

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
                  {lead.score !== null &&
                  lead.score !== undefined ? (
                    <span className="text-sm">
                      🔥 {lead.score}/10
                    </span>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="p-4">
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      updateStatus(
                        lead.id,
                        e.target.value
                      )
                    }
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                  >
                    {statusOptions.map((status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4">
                  <input
                    type="date"
                    value={lead.follow_up_date || ""}
                    onChange={(e) =>
                      updateFollowUp(
                        lead.id,
                        e.target.value
                      )
                    }
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                  />
                </td>

                <td className="p-4">
                  <button
                    onClick={() =>
                      deleteLead(lead.id)
                    }
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
