import { supabase } from "@/lib/supabase"
import Link from "next/link"
import ExpensesTable from "@/components/ExpensesTable"
import ExpensesStats from "@/components/ExpensesStats"
import { getExchangeRate } from "@/lib/currency"

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

export default async function ExpensesPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  const [{ data, error }, exchangeRate] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, payee, category, amount, currency, date, note, created_at")
      .order("date", { ascending: false }),
    getExchangeRate(),
  ])

  if (error) {
    return (
      <div style={{ color: "var(--red)", padding: 20 }}>
        Error loading expenses: {error.message}
      </div>
    )
  }

  const expenses = (data || []) as Expense[]

  // Normalise all amounts to INR for stats.
  // ExpensesStats and ExpensesTable both call useCurrency().fmt() which
  // converts INR → display currency on the client.
  const toINR = (e: Expense) =>
    e.currency === "USD" ? Number(e.amount) * exchangeRate : Number(e.amount)

  const total = expenses.reduce((s, e) => s + toINR(e), 0)

  const now = new Date()
  const thisMonth = expenses.filter((e) => {
    const d = new Date(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthTotal  = thisMonth.reduce((s, e) => s + toINR(e), 0)
  const last30Total = expenses
    .filter((e) => e.date >= thirtyDaysAgo)
    .reduce((s, e) => s + toINR(e), 0)

  const byCategory: Record<string, number> = {}
  for (const e of thisMonth) {
    byCategory[e.category] = (byCategory[e.category] || 0) + toINR(e)
  }
  const topCategoryEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
  const topCategory: [string, number] | null = topCategoryEntry ?? null

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

      <ExpensesStats
        monthTotal={monthTotal}
        last30Total={last30Total}
        total={total}
        topCategory={topCategory}
        byCategory={byCategory}
      />

      {/* Table */}
      <div className="fade-up delay-3">
        <ExpensesTable initialExpenses={expenses} />
      </div>
    </div>
  )
}
