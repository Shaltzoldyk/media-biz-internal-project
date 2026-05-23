import { supabase } from "@/lib/supabase"
import { getExchangeRate } from "@/lib/currency"

export const dynamic = "force-dynamic"

// ─── types ────────────────────────────────────────────────────────────────────

type MonthRow = {
  key: string          // "2025-03"
  label: string        // "Mar 2025"
  revenue: number
  expenses: number
  net: number
  margin: number | null
  runningNet: number
}

type CategoryTotals = Record<string, number>

// ─── helpers ─────────────────────────────────────────────────────────────────

function inr(n: number, opts?: { compact?: boolean }) {
  const abs = Math.abs(Math.round(n))
  let s: string
  if (opts?.compact) {
    if (abs >= 1_00_00_000) s = `₹${(abs / 1_00_00_000).toFixed(1)}Cr`
    else if (abs >= 1_00_000) s = `₹${(abs / 1_00_000).toFixed(1)}L`
    else if (abs >= 1_000)    s = `₹${(abs / 1_000).toFixed(1)}K`
    else s = `₹${abs}`
  } else {
    s = `₹${abs.toLocaleString("en-IN")}`
  }
  return n < 0 ? `−${s}` : s
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function monthLabel(key: string) {
  const [y, m] = key.split("-")
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("en-IN", { month: "short", year: "numeric" })
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function BalanceSheetPage() {
  const [
    { data: revenueRecords },
    { data: expenseRecords },
    exchangeRate,
  ] = await Promise.all([
    supabase
      .from("revenue_records")
      .select("amount, revenue_date, created_at"),
    supabase
      .from("expenses")
      .select("amount, currency, date, category"),
    getExchangeRate(),
  ])

  const revenue  = revenueRecords  || []
  const expenses = expenseRecords  || []

  function toINR(amount: number, currency: string) {
    return currency === "USD" ? amount * exchangeRate : amount
  }

  // ── Build per-month maps ───────────────────────────────────────────────────

  const revenueByMonth:  Record<string, number>          = {}
  const expensesByMonth: Record<string, number>          = {}
  const categoryByMonth: Record<string, CategoryTotals>  = {}
  const allKeys = new Set<string>()

  for (const r of revenue) {
    const dateStr = r.revenue_date || r.created_at
    if (!dateStr) continue
    const k = monthKey(dateStr)
    allKeys.add(k)
    revenueByMonth[k] = (revenueByMonth[k] || 0) + Number(r.amount || 0)
  }

  for (const e of expenses) {
    if (!e.date) continue
    const k   = monthKey(e.date)
    const amt = toINR(Number(e.amount || 0), e.currency)
    allKeys.add(k)
    expensesByMonth[k] = (expensesByMonth[k] || 0) + amt
    if (!categoryByMonth[k]) categoryByMonth[k] = {}
    categoryByMonth[k][e.category] = (categoryByMonth[k][e.category] || 0) + amt
  }

  // ── Sort months chronologically, build rows ───────────────────────────────

  const sortedKeys = Array.from(allKeys).sort()
  let runningNet   = 0
  const rows: MonthRow[] = sortedKeys.map((key) => {
    const rev = revenueByMonth[key]  || 0
    const exp = expensesByMonth[key] || 0
    const net = rev - exp
    runningNet += net
    return {
      key,
      label:      monthLabel(key),
      revenue:    rev,
      expenses:   exp,
      net,
      margin:     rev > 0 ? (net / rev) * 100 : null,
      runningNet,
    }
  })

  const rowsDesc = [...rows].reverse()

  // ── Aggregates ────────────────────────────────────────────────────────────

  const totalRevenue  = rows.reduce((s, r) => s + r.revenue,  0)
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0)
  const totalNet      = totalRevenue - totalExpenses
  const overallMargin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : null

  const nowKey       = new Date().toISOString().slice(0, 7)
  const thisMonth    = rows.find((r) => r.key === nowKey)
  const lmDate       = new Date(); lmDate.setMonth(lmDate.getMonth() - 1)
  const lastMonth    = rows.find((r) => r.key === lmDate.toISOString().slice(0, 7))

  const allCategoryTotals: CategoryTotals = {}
  for (const e of expenses) {
    const amt = toINR(Number(e.amount || 0), e.currency)
    allCategoryTotals[e.category] = (allCategoryTotals[e.category] || 0) + amt
  }
  const topCategories = Object.entries(allCategoryTotals).sort((a, b) => b[1] - a[1])

  const usdCount = expenses.filter((e) => e.currency === "USD").length

  // ─────────────────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div>
        <div className="page-header fade-up">
          <div className="label">Finance</div>
          <h1>Balance Sheet</h1>
        </div>
        <div className="card" style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)" }}>
          No data yet. Log client payments and add expenses to get started.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Finance</div>
        <h1>Balance Sheet</h1>
      </div>

      {/* USD conversion notice */}
      {usdCount > 0 && (
        <div className="fade-up" style={{
          marginBottom: 20, padding: "10px 14px",
          background: "var(--accent-dim)", border: "1px solid var(--accent)",
          borderRadius: "var(--radius)", fontSize: "0.78rem", color: "var(--accent-text)",
        }}>
          {usdCount} USD expense{usdCount !== 1 ? "s" : ""} converted to INR at ₹{exchangeRate.toFixed(2)}/$1. Totals reflect today's rate.
        </div>
      )}

      {/* ── Summary stats ── */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 10,
      }}>
        <div className="card stat">
          <div className="label">All-time revenue</div>
          <div className="val" style={{ fontSize: "1.2rem", color: "var(--green)" }}>{inr(totalRevenue)}</div>
        </div>
        <div className="card stat">
          <div className="label">All-time expenses</div>
          <div className="val" style={{ fontSize: "1.2rem", color: "var(--red)" }}>{inr(totalExpenses)}</div>
        </div>
        <div className="card stat">
          <div className="label">Net position</div>
          <div className="val" style={{ fontSize: "1.2rem", color: totalNet >= 0 ? "var(--green)" : "var(--red)" }}>
            {inr(totalNet)}
          </div>
          {overallMargin != null && (
            <div className="sub">{overallMargin.toFixed(1)}% margin</div>
          )}
        </div>
        <div className="card stat">
          <div className="label">Months tracked</div>
          <div className="val" style={{ fontSize: "1.2rem" }}>{rows.length}</div>
        </div>
      </div>

      {/* ── This / last month ── */}
      <div className="fade-up delay-2" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28,
      }}>
        <PeriodCard label="This month"  row={thisMonth} />
        <PeriodCard label="Last month"  row={lastMonth} />
      </div>

      {/* ── Monthly P&L table ── */}
      <div className="fade-up delay-3" style={{ marginBottom: 28 }}>
        <div className="label" style={{ marginBottom: 10 }}>Monthly P&L</div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: "right" }}>Revenue</th>
                <th style={{ textAlign: "right" }}>Expenses</th>
                <th style={{ textAlign: "right" }}>Net</th>
                <th style={{ textAlign: "right" }}>Margin</th>
                <th style={{ textAlign: "right" }}>Running net</th>
              </tr>
            </thead>
            <tbody>
              {rowsDesc.map((row) => {
                const profit  = row.net >= 0
                const current = row.key === nowKey
                return (
                  <tr key={row.key} style={{ background: current ? "var(--accent-dim)" : undefined }}>
                    <td style={{ fontWeight: current ? 500 : 400 }}>
                      {row.label}
                      {current && (
                        <span className="pill pill-blue" style={{ marginLeft: 8, fontSize: "0.65rem" }}>
                          current
                        </span>
                      )}
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--green)" }}>
                      {row.revenue > 0 ? inr(row.revenue) : "—"}
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--red)" }}>
                      {row.expenses > 0 ? inr(row.expenses) : "—"}
                    </td>
                    <td className="mono" style={{
                      textAlign: "right", fontWeight: 600,
                      color: profit ? "var(--green)" : "var(--red)",
                    }}>
                      {inr(row.net)}
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--text-3)" }}>
                      {row.margin != null ? `${row.margin.toFixed(1)}%` : "—"}
                    </td>
                    <td className="mono" style={{
                      textAlign: "right",
                      color: row.runningNet >= 0 ? "var(--text-2)" : "var(--red)",
                    }}>
                      {inr(row.runningNet)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bg-2)" }}>
                <td style={{ fontWeight: 600, fontSize: "0.78rem" }}>Total</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>
                  {inr(totalRevenue)}
                </td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--red)" }}>
                  {inr(totalExpenses)}
                </td>
                <td className="mono" style={{
                  textAlign: "right", fontWeight: 700,
                  color: totalNet >= 0 ? "var(--green)" : "var(--red)",
                }}>
                  {inr(totalNet)}
                </td>
                <td className="mono" style={{ textAlign: "right", color: "var(--text-3)" }}>
                  {overallMargin != null ? `${overallMargin.toFixed(1)}%` : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Expense breakdown ── */}
      {topCategories.length > 0 && (
        <div className="fade-up delay-4">
          <div className="label" style={{ marginBottom: 10 }}>All-time expenses by category</div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>% of revenue</th>
                  <th style={{ textAlign: "right" }}>% of expenses</th>
                </tr>
              </thead>
              <tbody>
                {topCategories.map(([cat, amt]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--red)" }}>
                      {inr(amt)}
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--text-3)" }}>
                      {totalRevenue > 0 ? `${((amt / totalRevenue) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <div style={{
                          height: 4, borderRadius: 99, background: "var(--border-md)",
                          width: 80, overflow: "hidden", flexShrink: 0,
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 99, background: "var(--red)",
                            width: `${totalExpenses > 0 ? Math.min(100, (amt / totalExpenses) * 100) : 0}%`,
                          }} />
                        </div>
                        <span className="mono" style={{ color: "var(--text-3)", fontSize: "0.78rem", minWidth: 40, textAlign: "right" }}>
                          {totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PeriodCard({ label, row }: { label: string; row: MonthRow | undefined }) {
  if (!row) {
    return (
      <div className="card stat">
        <div className="label">{label}</div>
        <div style={{ color: "var(--text-3)", fontSize: "0.82rem", marginTop: 8 }}>No data</div>
      </div>
    )
  }
  const profit = row.net >= 0
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div className="label" style={{ marginBottom: 12 }}>{label} · {row.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div>
          <div className="label" style={{ marginBottom: 3 }}>Revenue</div>
          <div className="mono" style={{ fontSize: "0.9rem", color: "var(--green)", fontWeight: 600 }}>
            {row.revenue > 0 ? inr(row.revenue, { compact: true }) : "—"}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 3 }}>Expenses</div>
          <div className="mono" style={{ fontSize: "0.9rem", color: "var(--red)", fontWeight: 600 }}>
            {row.expenses > 0 ? inr(row.expenses, { compact: true }) : "—"}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 3 }}>Net</div>
          <div className="mono" style={{ fontSize: "0.9rem", color: profit ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
            {inr(row.net, { compact: true })}
          </div>
        </div>
      </div>
      {row.margin != null && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 3, borderRadius: 99, background: "var(--border-md)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: profit ? "var(--green)" : "var(--red)",
              width: `${Math.min(100, Math.max(0, row.margin))}%`,
            }} />
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: 4 }}>
            {row.margin.toFixed(1)}% margin
          </div>
        </div>
      )}
    </div>
  )
}
