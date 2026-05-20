"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import RevenueSection from "./RevenueSection"
import { logActivity } from "@/lib/activity"
import { useCurrency } from "@/context/CurrencyContext"

const billingLabel: Record<string,string> = {
  weekly:"Weekly", bi_weekly:"Bi-weekly", monthly:"Monthly", one_time:"One-time",
}

export default function ClientCard({ client }: { client: any }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(client.contract_value || 0)
  const [billing, setBilling] = useState(client.billing_type)
  const [saving,  setSaving]  = useState(false)
  const { fmt }               = useCurrency()

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from("clients")
      .update({ contract_value: value, billing_type: billing })
      .eq("id", client.id)
    if (!error && (Number(client.contract_value) !== Number(value) || client.billing_type !== billing)) {
      await logActivity({
        entityType:"client", entityId:client.id, type:"contract_update",
        metadata:{ previousValue:client.contract_value, newValue:value, previousBilling:client.billing_type, newBilling:billing },
      })
    }
    setSaving(false); setEditing(false)
    location.reload()
  }

  const initials = client.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="card" style={{ padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:36, height:36, borderRadius:"50%",
            background:"var(--accent-dim)", color:"var(--accent-text)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"0.72rem", fontWeight:600, flexShrink:0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight:500, fontSize:"0.9rem" }}>{client.name}</div>
            <div style={{ fontSize:"0.72rem", color:"var(--text-3)", marginTop:1 }}>
              {client.brand_name || "—"}
            </div>
          </div>
        </div>
        <button onClick={() => setEditing(!editing)} className="btn" style={{ padding:"3px 10px", fontSize:"0.75rem" }}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14, paddingTop:12, borderTop:"1px solid var(--border)" }}>
          <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} placeholder="Contract value (₹ INR)" />
          <select value={billing} onChange={(e) => setBilling(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="bi_weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="one_time">One-time</option>
          </select>
          <button onClick={save} className="btn btn-primary" disabled={saving} style={{ alignSelf:"flex-start" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", gap:20, paddingTop:12, marginBottom:14, borderTop:"1px solid var(--border)" }}>
          <div>
            <div className="label" style={{ marginBottom:3 }}>Contract</div>
            <div className="mono" style={{ fontSize:"0.875rem" }}>{fmt(client.contract_value)}</div>
          </div>
          <div>
            <div className="label" style={{ marginBottom:3 }}>Billing</div>
            <span className="pill pill-gray">{billingLabel[client.billing_type] || client.billing_type}</span>
          </div>
        </div>
      )}

      <RevenueSection client={client} />
    </div>
  )
}