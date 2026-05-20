import { supabase } from "@/lib/supabase"
import Link from "next/link"
import LeadsTable from "@/components/LeadsTable"
import { Lead } from "@/types/lead"

export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })

  const leads = (data || []) as Lead[]
  const stats = {
    total:  leads.length,
    active: leads.filter((l) => !["Client","Lost"].includes(l.status)).length,
    hot:    leads.filter((l) => (l.score || 0) >= 7).length,
  }

  return (
    <div>
      <div className="page-header fade-up" style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
        <div>
          <div className="label">Acquisition</div>
          <h1>Leads</h1>
        </div>
        <Link href="/leads/new" className="btn btn-primary">+ New lead</Link>
      </div>

      <div className="fade-up delay-1" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:24 }}>
        {[
          { label:"Total",          val:stats.total },
          { label:"Active",         val:stats.active },
          { label:"Hot (score ≥ 7)",val:stats.hot },
        ].map((s) => (
          <div key={s.label} className="card stat">
            <div className="label">{s.label}</div>
            <div className="val">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="fade-up delay-2">
        {error
          ? <div style={{ color:"var(--red)" }}>Error loading leads.</div>
          : <LeadsTable initialLeads={leads} />}
      </div>
    </div>
  )
}