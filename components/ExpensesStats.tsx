"use client"

import { useCurrency } from "@/context/CurrencyContext"

type Props = {
  monthTotal: number
  last30Total: number
  total: number
  topCategory: [string, number] | null
  byCategory: Record<string, number>
}

export default function ExpensesStats({
  monthTotal,
  last30Total,
  total,
  topCategory,
  byCategory,
}: Props) {
  const { fmt } = useCurrency()

  return (
    <>
      {/* Summary stats */}
      <div className="fade-up delay-1" style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28,
      }}>
        <div className="card stat">
          <div className="label">This month</div>
          <div className="val" style={{ fontSize: "1.25rem", color: "var(--red)" }}>
            {fmt(monthTotal)}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Last 30 days</div>
          <div className="val" style={{ fontSize: "1.25rem" }}>{fmt(last30Total)}</div>
        </div>
        <div className="card stat">
          <div className="label">All time</div>
          <div className="val" style={{ fontSize: "1.25rem" }}>{fmt(total)}</div>
        </div>
        <div className="card stat">
          <div className="label">Top category (this month)</div>
          <div className="val" style={{ fontSize: "0.9rem", marginTop: 8 }}>
            {topCategory ? (
              <>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{topCategory[0]}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--red)", marginTop: 2 }}>
                  {fmt(topCategory[1])}
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
                    {fmt(amt)}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
                    {monthTotal > 0 ? `${Math.round((amt / monthTotal) * 100)}% of month` : ""}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  )
}
