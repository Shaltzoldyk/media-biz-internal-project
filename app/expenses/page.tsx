import { supabase } from "@/lib/supabase"
import Link from "next/link"
import ExpensesTable from "@/components/ExpensesTable"

export const dynamic = "force-dynamic"

// Category definitions — single source of truth used by page + form
export const EXPENSE_CATEGORIES = [
  "Contractor / Freelancer",
  "Software & Tools",
  "Equipment",
  "Marketing & Ads",
  "Office & Admin",
  "Travel",
  "Other",
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export type Expense = {
  id: string
  payee: string
  category: ExpenseCategory
  amount: number
  currency: "INR" | "USD"
  date: string
  note: string | null
  created_at: string
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

export default async function ExpensesPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  const { data, error } = await supabase
    .from("expenses")
    .select("id, payee, category, amount, currency, date, note, created_at")
    .order("date", { ascending: false })

  if (error) {
    return (
      <div style={{ color: "var(--red)", padding: 20 }}>
        Error loading expenses: {error.message}
      </div>
    )
  }

  const expenses = (data || []) as Expense[]

  // Summary stats
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0)

  const last30 = expenses.filter((e) => e.date >= thirtyDaysAgo)
  const last30Total = last30.reduce((s, e) => s + Number(e.amount), 0)

  // By-category breakdown for this month
  const byCategory: Record<string, number> = {}
  for (const e of thisMonth) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
  }
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]

  return (
    <div>
      <div className="page-header fade-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div className="label">Finance</div>
          <h1>Expenses</h1>
        </div>
        <Link href="/expenses/new" className="btn btn-primary" style={{ marginBottom: 4 }}>
          + Add expense
        </Link>
      </div>

      {/* Summary stats */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28,
      }}>
        <div className="card stat">
          <div className="label">This month</div>
          <div className="val" style={{ fontSize: "1.25rem", color: "var(--red)" }}>
            {inr(monthTotal)}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Last 30 days</div>
          <div className="val" style={{ fontSize: "1.25rem" }}>{inr(last30Total)}</div>
        </div>
        <div className="card stat">
          <div className="label">All time</div>
          <div className="val" style={{ fontSize: "1.25rem" }}>{inr(total)}</div>
        </div>
        <div className="card stat">
          <div className="label">Top category (this month)</div>
          <div className="val" style={{ fontSize: "0.9rem", marginTop: 8 }}>
            {topCategory ? (
              <>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{topCategory[0]}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--red)", marginTop: 2 }}>
                  {inr(topCategory[1])}
                </div>
              </>
            ) : (
              <span style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Category breakdown — this month */}
      {Object.keys(byCategory).length > 0 && (
        <div className="fade-up delay-2" style={{ marginBottom: 24 }}>
          <div className="label" style={{ marginBottom: 10 }}>This month by category</div>
          <div className="card" style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <div key={cat} style={{
                  display: "flex", flexDirection: "column", gap: 2,
                  background: "var(--bg-2)", borderRadius: "var(--radius)",
                  padding: "8px 12px", minWidth: 120,
                }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 500 }}>{cat}</div>
                  <div className="mono" style={{ fontSize: "0.85rem", color: "var(--red)", fontWeight: 600 }}>
                    {inr(amt)}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
                    {monthTotal > 0 ? `${Math.round((amt / monthTotal) * 100)}% of month` : ""}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="fade-up delay-3">
        <ExpensesTable initialExpenses={expenses} />
      </div>
    </div>
  )
}
