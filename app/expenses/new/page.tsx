"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const EXPENSE_CATEGORIES = [
  "Contractor / Freelancer",
  "Software & Tools",
  "Equipment",
  "Marketing & Ads",
  "Office & Admin",
  "Travel",
  "Other",
] as const

export default function NewExpensePage() {
  const router = useRouter()

  const [payee,    setPayee]    = useState("")
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [amount,   setAmount]   = useState("")
  const [currency, setCurrency] = useState<"INR" | "USD">("INR")
  const [date,     setDate]     = useState(() => new Date().toISOString().split("T")[0])
  const [note,     setNote]     = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payee.trim())  { setError("Payee is required."); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Enter a valid amount."); return
    }

    setLoading(true)
    setError("")

    const { error: err } = await supabase.from("expenses").insert([{
      payee:    payee.trim(),
      category,
      amount:   Number(amount),
      currency,
      date,
      note:     note.trim() || null,
    }])

    if (err) {
      setError("Failed to save expense.")
      setLoading(false)
      return
    }

    router.push("/expenses")
    router.refresh()
  }

  return (
    <div>
      <div className="page-header fade-up">
        <div className="label">Finance</div>
        <h1>Add expense</h1>
      </div>

      <div className="fade-up delay-1" style={{ maxWidth: 480 }}>
        <div className="card" style={{ padding: "28px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <Field label="Payee *">
                <input
                  type="text"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="e.g. Rohan Mehta, Adobe, AWS"
                  autoFocus
                />
              </Field>

              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              {/* Amount + currency on one row */}
              <Field label="Amount *">
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as "INR" | "USD")}
                    style={{ width: 80, flexShrink: 0 }}
                  >
                    <option value="INR">₹ INR</option>
                    <option value="USD">$ USD</option>
                  </select>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </Field>

              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>

              <Field label="Note">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional — invoice ref, project, context…"
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </Field>

              {error && (
                <div style={{ color: "var(--red)", fontSize: "0.82rem" }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Saving…" : "Save expense"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => router.push("/expenses")}
                >
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
      <label style={{
        display: "block", fontSize: "0.78rem", fontWeight: 500,
        color: "var(--text-2)", marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}
