"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { calculateLeadScore } from "@/lib/leadScore"
import { logActivity } from "@/lib/activity"

const PLATFORMS = ["YouTube","Instagram","Twitter","LinkedIn","Podcast","Newsletter","Other"]

export default function NewLeadPage() {
  const router = useRouter()
  const [name,        setName]       = useState("")
  const [brand,       setBrand]      = useState("")
  const [platform,    setPlatform]   = useState("YouTube")
  const [subscribers, setSubs]       = useState("")
  const [value,       setValue]      = useState("")
  const [warmIntro,   setWarmIntro]  = useState(false)
  const [loading,     setLoading]    = useState(false)
  const [error,       setError]      = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError("Name is required."); return }
    setLoading(true); setError("")

    const subs  = Number(subscribers) || 0
    const deal  = Number(value) || 0
    const score = calculateLeadScore({ subscribers:subs, outsourcing:false, uploadsWeekly:true, monetized:true, warmIntro })
    const ts    = new Date().toISOString()

    const { data: lead, error: err } = await supabase
      .from("leads")
      .insert([{ name:name.trim(), brand_name:brand||null, platform, subscriber_count:subs, value:deal, score, status:"New", stage_changed_at:ts }])
      .select().single()

    if (err || !lead) { setError("Failed to create lead."); setLoading(false); return }

    await logActivity({ entityType:"lead", entityId:lead.id, type:"lead_created", metadata:{ name:lead.name, score, platform } })
    router.push("/leads")
  }

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Acquisition</div>
        <h1>New lead</h1>
      </div>

      <div className="fade-up delay-1" style={{ maxWidth: 480 }}>
        <div className="card" style={{ padding:"28px 28px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              <Field label="Creator name *">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ranveer Allahbadia" autoFocus />
              </Field>

              <Field label="Brand / channel name">
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. BeerBiceps" />
              </Field>

              <Field label="Platform">
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>

              <Field label="Subscriber / follower count">
                <input type="number" value={subscribers} onChange={(e) => setSubs(e.target.value)}
                  placeholder="e.g. 500000" min="0" />
              </Field>

              <Field label="Deal value (₹)">
                <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. 150000" min="0" />
              </Field>

              <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:"0.875rem" }}>
                <input type="checkbox" checked={warmIntro} onChange={(e) => setWarmIntro(e.target.checked)}
                  style={{ width:"auto" }} />
                <span>Warm intro / referral</span>
              </label>

              {error && <div style={{ color:"var(--red)", fontSize:"0.82rem" }}>{error}</div>}

              <div style={{ display:"flex", gap:8, paddingTop:4 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Creating…" : "Create lead"}
                </button>
                <button type="button" className="btn" onClick={() => router.push("/leads")}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:"block", fontSize:"0.78rem", fontWeight:500, color:"var(--text-2)", marginBottom:5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}