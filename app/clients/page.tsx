import { supabase } from "@/lib/supabase"
import ClientCard from "@/components/ClientCard"

export const dynamic = "force-dynamic"

export default async function ClientsPage() {
  const [{ data: clients, error }, { data: revenue }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("revenue_records").select("client_id, amount, revenue_date"),
  ])

  if (error) return <div style={{ color: "var(--red)" }}>Error loading clients.</div>

  const active = (clients || []).filter((c) => c.status !== "churned")

  // P-7: build revenue totals map once — O(n) instead of O(n²)
  const revenueTotals = new Map<string, number>()
  for (const r of revenue || []) {
    revenueTotals.set(r.client_id, (revenueTotals.get(r.client_id) || 0) + Number(r.amount || 0))
  }

  const totalMRR = active.reduce((sum, c) => {
    const v = Number(c.contract_value || 0)
    if (c.billing_type === "weekly")    return sum + v * 4
    if (c.billing_type === "bi_weekly") return sum + v * 2
    if (c.billing_type === "monthly")   return sum + v
    return sum
  }, 0)

  const totalOutstanding = active.reduce((sum, c) => {
    const paid = revenueTotals.get(c.id) || 0
    const val  = Number(c.contract_value || 0)
    let expected = 0

    if (c.billing_type === "one_time") {
      expected = val
    } else if (c.start_date) {
      const start = new Date(c.start_date)
      const now   = new Date()
      const days  = (now.getTime() - start.getTime()) / 86400000
      let periods = 0
      if (c.billing_type === "weekly")    periods = Math.floor(days / 7)
      if (c.billing_type === "bi_weekly") periods = Math.floor(days / 14)
      if (c.billing_type === "monthly")
        periods = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
      expected = Math.max(1, periods) * val
    }

    return sum + Math.max(0, expected - paid)
  }, 0)

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Revenue</div>
        <h1>Clients</h1>
      </div>

      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 28,
      }}>
        <div className="card stat">
          <div className="label">Active clients</div>
          <div className="val">{active.length}</div>
        </div>
        <div className="card stat">
          <div className="label">Est. MRR (₹)</div>
          <div className="val" style={{ fontSize: "1.3rem" }}>
            ₹{totalMRR.toLocaleString("en-IN")}
          </div>
          <div className="sub">stored in INR · toggle ₹/$ in sidebar</div>
        </div>
        <div className="card stat">
          <div className="label">Outstanding (₹)</div>
          <div className="val" style={{
            fontSize: "1.3rem",
            color: totalOutstanding > 0 ? "var(--red)" : "var(--green)",
          }}>
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      <div className="fade-up delay-2" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 14,
      }}>
        {active.length === 0
          ? <div style={{ color: "var(--text-3)" }}>No active clients yet.</div>
          : active.map((c) => <ClientCard key={c.id} client={c} />)}
      </div>
    </div>
  )
}