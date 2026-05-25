"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/context/CurrencyContext"
import type { Expense, ExpenseCategory } from "@/app/expenses/page"

const CATEGORY_COLORS: Record<string, string> = {
  "Contractor / Freelancer": "pill-blue",
  "Software & Tools":        "pill-gray",
  "Equipment":               "pill-gray",
  "Marketing & Ads":         "pill-amber",
  "Office & Admin":          "pill-gray",
  "Travel":                  "pill-gray",
  "Other":                   "pill-gray",
}

const ALL_CATEGORIES = [
  "Contractor / Freelancer",
  "Software & Tools",
  "Equipment",
  "Marketing & Ads",
  "Office & Admin",
  "Travel",
  "Other",
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

export default function ExpensesTable({ initialExpenses }: { initialExpenses: Expense[] }) {
  const { fmt, rate } = useCurrency()

  // Expenses are stored in their original currency (INR or USD).
  // fmt() expects INR, so convert USD-stored amounts to INR first using the
  // live rate, then fmt() will convert back to USD if the toggle is on.
  const fmtExpense = (amount: number, currency: string) =>
    fmt(currency === "USD" ? amount * rate : amount)

  const [expenses,        setExpenses]       = useState<Expense[]>(initialExpenses)
  const [categoryFilter,  setCategoryFilter] = useState("")
  const [search,          setSearch]         = useState("")
  const [deletingId,      setDeletingId]     = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    const exp = expenses.find((e) => e.id === id)
    if (!exp || !confirm(`Delete expense: ${exp.payee} (${fmtExpense(exp.amount, exp.currency)})?`)) return
    setDeletingId(id)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    await supabase.from("expenses").delete().eq("id", id)
    setDeletingId(null)
  }

  const filtered = expenses.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !e.payee.toLowerCase().includes(q) &&
        !e.category.toLowerCase().includes(q) &&
        !(e.note || "").toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0)

  if (!expenses.length) {
    return (
      <div className="card" style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)" }}>
        No expenses yet.{" "}
        <Link href="/expenses/new" style={{ color: "var(--accent)" }}>
          Add your first one →
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search payee, category, note…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(search || categoryFilter) && (
          <button
            className="btn btn-ghost"
            onClick={() => { setSearch(""); setCategoryFilter("") }}
            style={{ fontSize: "0.78rem" }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Payee</th>
              <th>Category</th>
              <th>Note</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((exp) => (
              <tr key={exp.id} style={{ opacity: deletingId === exp.id ? 0.4 : 1 }}>
                <td className="mono" style={{ fontSize: "0.78rem", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                  {fmtDate(exp.date)}
                </td>
                <td style={{ fontWeight: 500 }}>{exp.payee}</td>
                <td>
                  <span className={`pill ${CATEGORY_COLORS[exp.category] ?? "pill-gray"}`}>
                    {exp.category}
                  </span>
                </td>
                <td style={{ color: "var(--text-3)", fontSize: "0.8rem", maxWidth: 220 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "block", whiteSpace: "nowrap" }}>
                    {exp.note || <span style={{ color: "var(--text-3)" }}>—</span>}
                  </span>
                </td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 600, color: "var(--red)", whiteSpace: "nowrap" }}>
                  {fmtExpense(exp.amount, exp.currency)}
                </td>
                <td>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="btn btn-ghost btn-danger"
                    style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                    disabled={deletingId === exp.id}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{
                  fontSize: "0.72rem", color: "var(--text-3)", padding: "10px 14px",
                  borderTop: "1px solid var(--border)",
                }}>
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                  {(search || categoryFilter) ? " (filtered)" : ""}
                </td>
                <td className="mono" style={{
                  textAlign: "right", fontWeight: 700, color: "var(--red)",
                  padding: "10px 14px", borderTop: "1px solid var(--border)", whiteSpace: "nowrap",
                }}>
                  {fmt(filteredTotal)}
                </td>
                <td style={{ borderTop: "1px solid var(--border)" }} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
