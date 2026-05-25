"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logActivity } from "@/lib/activity"
import { useCurrency } from "@/context/CurrencyContext"

function calcPeriods(startDate: string, billing: string): number {
  if (!startDate) return 0
  const start = new Date(startDate), now = new Date()
  if (isNaN(start.getTime())) return 0
  const days = (now.getTime() - start.getTime()) / 86400000
  if (billing === "weekly")    return Math.floor(days / 7)
  if (billing === "bi_weekly") return Math.floor(days / 14)
  if (billing === "monthly")
    return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  return 0
}

export default function RevenueSection({ client }: { client: any }) {
  const [records,   setRecords]   = useState<any[]>([])
  const [amount,    setAmount]    = useState("")
  const [showInput, setShowInput] = useState(false)
  const [adding,    setAdding]    = useState(false)
  const { fmt }                   = useCurrency()

  const fetchRecords = async () => {
    const { data } = await supabase
      .from("revenue_records")
      .select("*")
      .eq("client_id", client.id)
      .order("revenue_date", { ascending: false })
    setRecords(data || [])
  }

  useEffect(() => { fetchRecords() }, [])

  const addPayment = async () => {
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) return
    setAdding(true)
    const date = new Date().toISOString().split("T")[0]
    const { data, error } = await supabase
      .from("revenue_records")
      .insert({ client_id:client.id, amount:amt, revenue_date:date, type:"payment" })
      .select().single()
    if (!error) {
      await logActivity({ entityType:"client", entityId:client.id, type:"payment_logged", metadata:{ paymentId:data.id, amount:amt, revenueDate:date } })
    }
    setAmount(""); setAdding(false); setShowInput(false)
    fetchRecords()
  }

  const deletePayment = async (id: string) => {
    const r = records.find((x) => x.id === id)
    if (!r) return
    await supabase.from("revenue_records").delete().eq("id", id)
    await logActivity({ entityType:"client", entityId:client.id, type:"payment_deleted", metadata:{ paymentId:id, amount:r.amount } })
    fetchRecords()
  }

  const lifetime    = records.reduce((s, r) => s + Number(r.amount || 0), 0)
  const periods     = client.start_date ? Math.max(1, calcPeriods(client.start_date, client.billing_type)) : 1
  const contract    = Number(client.contract_value || 0)
  const expected    = client.billing_type === "one_time" ? contract : periods * contract
  const outstanding = expected - lifetime

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:12 }}>
        {[
          { label:"Lifetime",    val:lifetime,            color:undefined,                      bg:undefined },
          { label:"Expected",    val:expected,            color:undefined,                      bg:undefined },
          { label:"Outstanding", val:Math.abs(outstanding),
            color: outstanding > 0 ? "var(--red)" : "var(--green)",
            bg:    outstanding > 0 ? "var(--red-dim)" : "var(--green-dim)" },
        ].map((s) => (
          <div key={s.label} style={{
            background: s.bg || "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "8px 10px",
          }}>
            <div className="label" style={{ marginBottom:3 }}>{s.label}</div>
            <div className="mono" style={{ fontSize:"0.8rem", color: s.color || "var(--text)" }}>
              {fmt(s.val)}
            </div>
          </div>
        ))}
      </div>

      {/* Add payment — always in ₹ regardless of display toggle */}
      {showInput ? (
        <div style={{ display:"flex", gap:6, marginBottom:10 }}>
          <input
            type="number" value={amount} autoFocus
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in ₹ INR"
            onKeyDown={(e) => { if (e.key==="Enter") addPayment(); if (e.key==="Escape") setShowInput(false) }}
            style={{ flex:1 }}
          />
          <button onClick={addPayment} className="btn btn-primary" disabled={adding} style={{ flexShrink:0 }}>
            {adding ? "…" : "Log"}
          </button>
          <button onClick={() => setShowInput(false)} className="btn" style={{ flexShrink:0 }}>×</button>
        </div>
      ) : (
        <button onClick={() => setShowInput(true)} className="btn btn-ghost"
          style={{ fontSize:"0.75rem", marginBottom: records.length ? 10 : 0 }}>
          + Log payment
        </button>
      )}

      {/* History */}
      {records.map((r) => (
        <div key={r.id} style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"7px 0", borderTop:"1px solid var(--border)", fontSize:"0.8rem",
        }}>
          <span className="mono">{fmt(r.amount)}</span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span className="mono" style={{ fontSize:"0.72rem", color:"var(--text-3)" }}>{r.revenue_date}</span>
            <button onClick={() => deletePayment(r.id)} className="btn btn-ghost btn-danger"
              style={{ padding:"2px 6px", fontSize:"0.72rem" }}>×</button>
          </div>
        </div>
      ))}
    </div>
  )
}