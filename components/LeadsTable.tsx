"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

const statusOptions = [
  "New",
  "Qualified",
  "Contacted",
  "Responded",
  "Call Booked",
  "Client",
  "Lost",
]

export default function LeadsTable({ initialLeads }: any) {
  const [leads, setLeads] = useState(initialLeads)

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", id)

    setLeads((prev: any) =>
      prev.map((lead: any) =>
        lead.id === id ? { ...lead, status: newStatus } : lead
      )
    )
  }

  const deleteLead = async (id: string) => {
    await supabase.from("leads").delete().eq("id", id)

    setLeads((prev: any) => prev.filter((lead: any) => lead.id !== id))
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
            <th className="p-4">Status</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>

        <tbody>
          {leads.map((lead: any) => (
            <tr
              key={lead.id}
              className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
            >
              <td className="p-4 font-medium">{lead.name}</td>
              <td className="p-4 text-zinc-400">
                {lead.brand_name || "-"}
              </td>
              <td className="p-4">{lead.platform}</td>
              <td className="p-4">
                {lead.subscriber_count
                  ? lead.subscriber_count.toLocaleString()
                  : "-"}
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
