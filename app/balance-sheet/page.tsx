import { supabase } from "@/lib/supabase"
import { getExchangeRate } from "@/lib/currency"
import BalanceSheetView from "@/components/BalanceSheetView"

export const dynamic = "force-dynamic"

type MonthRow = {
  key: string
  label: string
  revenue: number
  expenses: number
  net: number
  margin: number | null
  runningNet: number
}

function monthKey(dateStr: string) { return dateStr.slice(0, 7) }

function monthLabel(key: string) {
  const [y, m] = key.split("-")
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("en-IN", { month: "short", year: "numeric" })
}

export default async function BalanceSheetPage() {
  const [
    { data: revenueRecords },
    { data: expenseRecords },
    exchangeRate,
  ] = await Promise.all([
    // Intentionally unbounded — the balance sheet needs all-time revenue
    // to build the running net column and accurate monthly P&L rows.
    supabase.from("revenue_records").select("amount, revenue_date, created_at"),
    supabase.from("expenses").select("amount, currency, date, category"),
    getExchangeRate(),
  ])

  const revenue  = revenueRecords  || []
  const expenses = expenseRecords  || []

  const toINR = (amount: number, currency: string) =>
    currency === "USD" ? amount * exchangeRate : amount

  const revenueByMonth:  Record<string, number> = {}
  const expensesByMonth: Record<string, number> = {}
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
  }

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

  const totalRevenue  = rows.reduce((s, r) => s + r.revenue,  0)
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0)
  const totalNet      = totalRevenue - totalExpenses
  const overallMargin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : null

  const nowKey    = new Date().toISOString().slice(0, 7)
  const lmDate    = new Date(); lmDate.setMonth(lmDate.getMonth() - 1)
  const thisMonth = rows.find((r) => r.key === nowKey)
  const lastMonth = rows.find((r) => r.key === lmDate.toISOString().slice(0, 7))

  const allCategoryTotals: Record<string, number> = {}
  for (const e of expenses) {
    const amt = toINR(Number(e.amount || 0), e.currency)
    allCategoryTotals[e.category] = (allCategoryTotals[e.category] || 0) + amt
  }
  const topCategories = Object.entries(allCategoryTotals).sort((a, b) => b[1] - a[1])
  const usdCount = expenses.filter((e) => e.currency === "USD").length

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

      <BalanceSheetView
        rows={rows}
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        totalNet={totalNet}
        overallMargin={overallMargin}
        thisMonth={thisMonth}
        lastMonth={lastMonth}
        topCategories={topCategories}
        usdCount={usdCount}
        exchangeRate={exchangeRate}
      />
    </div>
  )
}
