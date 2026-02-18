"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import RevenueSection from "./RevenueSection"
import { logActivity } from "@/lib/activity"

export default function ClientCard({ client }: any) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(client.contract_value || 0)
  const [billing, setBilling] = useState(client.billing_type)

  const save = async () => {
    const previousValue = client.contract_value
    const previousBilling = client.billing_type

    const { error } = await supabase
      .from("clients")
      .update({
        contract_value: value,
        billing_type: billing,
      })
      .eq("id", client.id)

    if (error) {
      console.error("Contract update failed:", error)
      return
    }

    // Log only if something changed
    if (
      Number(previousValue) !== Number(value) ||
      previousBilling !== billing
    ) {
      await logActivity({
        entityType: "client",
        entityId: client.id,
        type: "contract_update",
        metadata: {
          previousValue,
          newValue: value,
          previousBilling,
          newBilling: billing,
        },
      })
    }

    setEditing(false)
    location.reload()
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="font-medium text-lg">
          {client.name}
        </div>

        <button
          onClick={() => setEditing(!editing)}
          className="text-xs text-blue-400"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {/* Contract Section */}
      {editing ? (
        <div className="space-y-3 mt-3">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full bg-zinc-800 p-2 rounded"
          />

          <select
            value={billing}
            onChange={(e) => setBilling(e.target.value)}
            className="w-full bg-zinc-800 p-2 rounded"
          >
            <option value="weekly">Weekly</option>
            <option value="bi_weekly">Bi-Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="one_time">One-Time</option>
          </select>

          <button
            onClick={save}
            className="bg-green-600 px-3 py-1 rounded text-sm"
          >
            Save
          </button>
        </div>
      ) : (
        <>
          <div className="text-sm text-zinc-400 mt-2">
            ₹ {Number(client.contract_value || 0).toLocaleString()}
          </div>

          <div className="text-sm text-zinc-500">
            {client.billing_type}
          </div>
        </>
      )}

      {/* Revenue Tracking Section */}
      <RevenueSection client={client} />
    </div>
  )
}
