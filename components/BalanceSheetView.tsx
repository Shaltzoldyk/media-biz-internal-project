"use client"

import { useCurrency } from "@/context/CurrencyContext"

type MonthRow = {
  key: string
  label: string
  revenue: number
  expenses: number
  net: number
  margin: number | null
  runningNet: number
}

type Props = {
  rows: MonthRow[]
  totalRevenue: number
  totalExpenses: number
  totalNet: number
  overallMargin: number | null
  thisMonth: MonthRow | undefined
  lastMonth: MonthRow | undefined
  topCategories: [string, number][]
  usdCount: number
  exchangeRate: number
}

export default function BalanceSheetView({
  rows,
  totalRevenue,
  totalExpenses,
  totalNet,
  overallMargin,
  thisMonth,
  lastMonth,
  topCategories,
  usdCount,
  exchangeRate,
}: Props) {
  const { fmt, fmtCompact } = useCurrency()
  const nowKey     = new Date().toISOString().slice(0, 7)
  const rowsDesc   = [...rows].reverse()

  return (
    <>
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

      {/* Summary stats */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 10,
      }}>
        <div className="card stat">
          <div className="label">All-time revenue</div>
          <div className="val" style={{ fontSize: "1.2rem", color: "var(--green)" }}>{fmt(totalRevenue)}</div>
        </div>
        <div className="card stat">
          <div className="label">All-time expenses</div>
          <div className="val" style={{ fontSize: "1.2rem", color: "var(--red)" }}>{fmt(totalExpenses)}</div>
        </div>
        <div className="card stat">
          <div className="label">Net position</div>
          <div className="val" style={{ fontSize: "1.2rem", color: totalNet >= 0 ? "var(--green)" : "var(--red)" }}>
            {fmt(totalNet)}
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

      {/* This / last month */}
      <div className="fade-up delay-2" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28,
      }}>
        <PeriodCard label="This month"  row={thisMonth} fmtCompact={fmtCompact} />
        <PeriodCard label="Last month"  row={lastMonth} fmtCompact={fmtCompact} />
      </div>

      {/* Monthly P&L table */}
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
                      {row.revenue > 0 ? fmt(row.revenue) : "—"}
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--red)" }}>
                      {row.expenses > 0 ? fmt(row.expenses) : "—"}
                    </td>
                    <td className="mono" style={{
                      textAlign: "right", fontWeight: 600,
                      color: profit ? "var(--green)" : "var(--red)",
                    }}>
                      {fmt(row.net)}
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--text-3)" }}>
                      {row.margin != null ? `${row.margin.toFixed(1)}%` : "—"}
                    </td>
                    <td className="mono" style={{
                      textAlign: "right",
                      color: row.runningNet >= 0 ? "var(--text-2)" : "var(--red)",
                    }}>
                      {fmt(row.runningNet)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bg-2)" }}>
                <td style={{ fontWeight: 600, fontSize: "0.78rem" }}>Total</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>
                  {fmt(totalRevenue)}
                </td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--red)" }}>
                  {fmt(totalExpenses)}
                </td>
                <td className="mono" style={{
                  textAlign: "right", fontWeight: 700,
                  color: totalNet >= 0 ? "var(--green)" : "var(--red)",
                }}>
                  {fmt(totalNet)}
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

      {/* Expense breakdown */}
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
                      {fmt(amt)}
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
    </>
  )
}

function PeriodCard({
  label,
  row,
  fmtCompact,
}: {
  label: string
  row: MonthRow | undefined
  fmtCompact: (n: number | null | undefined) => string
}) {
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
            {row.revenue > 0 ? fmtCompact(row.revenue) : "—"}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 3 }}>Expenses</div>
          <div className="mono" style={{ fontSize: "0.9rem", color: "var(--red)", fontWeight: 600 }}>
            {row.expenses > 0 ? fmtCompact(row.expenses) : "—"}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 3 }}>Net</div>
          <div className="mono" style={{ fontSize: "0.9rem", color: profit ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
            {fmtCompact(row.net)}
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
