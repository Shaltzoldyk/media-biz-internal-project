"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logActivity } from "@/lib/activity"

function calculatePeriods(startDate: string, billing: string) {
  if (!startDate) return 0

  const start = new Date(startDate)
  const now = new Date()

  if (isNaN(start.getTime())) return 0

  const diffMs = now.getTime() - start.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (billing === "weekly") return Math.floor(diffDays / 7)
  if (billing === "bi_weekly") return Math.floor(diffDays / 14)
  if (billing === "monthly") return Math.floor(diffDays / 30)

  return 0
}

export default function RevenueSection({ client }: { client: any }) {
  const [amount, setAmount] = useState("")
  const [records, setRecords] = useState<any[]>([])

  const fetchRecords = async () => {
    const { data } = await supabase
      .from("revenue_records")
      .select("*")
      .eq("client_id", client.id)
      .order("revenue_date", { ascending: false })

    setRecords(data || [])
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  const addPayment = async () => {
    if (!amount) return

    const paymentAmount = Number(amount)
    const revenueDate = new Date().toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("revenue_records")
      .insert({
        client_id: client.id,
        amount: paymentAmount,
        revenue_date: revenueDate,
        type: "payment",
      })
      .select()
      .single()

    if (error) {
      console.error("Error adding payment:", error)
      return
    }

    // ✅ Log payment activity
    await logActivity({
      entityType: "client",
      entityId: client.id,
      type: "payment_logged",
      metadata: {
        paymentId: data.id,
        amount: paymentAmount,
        revenueDate,
      },
    })

    setAmount("")
    fetchRecords()
  }

  const deletePayment = async (id: string) => {
    const record = records.find((r) => r.id === id)
    if (!record) return

    const { error } = await supabase
      .from("revenue_records")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting payment:", error)
      return
    }

    // ✅ Log deletion activity
    await logActivity({
      entityType: "client",
      entityId: client.id,
      type: "payment_deleted",
      metadata: {
        paymentId: id,
        amount: record.amount,
        revenueDate: record.revenue_date,
      },
    })

    fetchRecords()
  }

  const lifetimeRevenue = records.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  )

  const periods =
    client.start_date
      ? Math.max(
          1,
          calculatePeriods(client.start_date, client.billing_type)
        )
      : 1

  const contractValue = Number(client.contract_value || 0)

  const expectedRevenue =
    client.billing_type === "one_time"
      ? contractValue
      : periods * contractValue

  const outstanding = expectedRevenue - lifetimeRevenue

  const healthColor =
    outstanding > 0 ? "text-red-400" : "text-green-400"

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4 space-y-3">
      <div className="text-sm">
        Lifetime Revenue: ₹ {lifetimeRevenue.toLocaleString()}
      </div>

      <div className="text-sm">
        Expected Revenue: ₹ {expectedRevenue.toLocaleString()}
      </div>

      <div className={`text-sm font-semibold ${healthColor}`}>
        Outstanding: ₹ {outstanding.toLocaleString()}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Payment amount"
          className="bg-zinc-800 p-2 rounded w-full"
        />

        <button
          onClick={addPayment}
          className="bg-green-600 px-3 rounded text-sm"
        >
          Add
        </button>
      </div>

      <div className="space-y-2 text-sm text-zinc-400">
        {records.map((r) => (
          <div
            key={r.id}
            className="flex justify-between items-center bg-zinc-800 p-2 rounded"
          >
            <div>
              ₹ {Number(r.amount).toLocaleString()} — {r.revenue_date}
            </div>

            <button
              onClick={() => deletePayment(r.id)}
              className="text-red-400 text-xs"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
