"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCurrency } from "@/context/CurrencyContext"
import { useTheme } from "@/context/ThemeContext"

const nav = [
  { group: "Workspace", items: [
    { name: "Today",     href: "/today" },
    { name: "Dashboard", href: "/" },
  ]},
  { group: "Pipeline", items: [
    { name: "Leads",    href: "/leads" },
    { name: "Pipeline", href: "/pipeline" },
    { name: "Outreach", href: "/outreach" },
  ]},
  { group: "Revenue", items: [
    { name: "Clients",       href: "/clients" },
    { name: "Analytics",     href: "/analytics" },
    { name: "Expenses",      href: "/expenses" },
    { name: "Balance Sheet", href: "/balance-sheet" },
  ]},
  { group: "Log", items: [
    { name: "Activity", href: "/activity" },
  ]},
]

export default function Sidebar() {
  const path = usePathname()
  const { currency, toggle: toggleCurrency } = useCurrency()
  const { theme, toggle: toggleTheme, isSystem } = useTheme()

  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href)

  return (
    <aside style={{
      width: 210, minWidth: 210, height: "100vh",
      position: "sticky", top: 0,
      background: "var(--bg)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "20px 12px",
      transition: "background var(--t) var(--ease), border-color var(--t) var(--ease)",
    }}>

      {/* Logo */}
      <div style={{ padding: "4px 8px 20px", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
          Lead OS
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--text-3)", marginTop: 1 }}>
          internal · v0.1
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto" }}>
        {nav.map((group) => (
          <div key={group.group} style={{ marginBottom: 20 }}>
            <div className="label" style={{ padding: "0 8px", marginBottom: 4 }}>
              {group.group}
            </div>
            {group.items.map((item) => {
              const on = active(item.href)
              return (
                <Link key={item.href} href={item.href} style={{
                  display: "block", padding: "6px 8px",
                  borderRadius: "var(--radius)",
                  fontSize: "0.875rem",
                  fontWeight: on ? 500 : 400,
                  color: on ? "var(--text)" : "var(--text-2)",
                  background: on ? "var(--bg-2)" : "transparent",
                  marginBottom: 1,
                  transition: "all var(--t) var(--ease)",
                }}>
                  {item.name}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer controls */}
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Currency toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Currency</span>
          <TogglePill
            options={["₹", "$"]}
            active={currency === "INR" ? "₹" : "$"}
            onSelect={(v) => { if ((v === "₹") !== (currency === "INR")) toggleCurrency() }}
          />
        </div>

        {/* Theme toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
            {isSystem ? "Theme · auto" : "Theme"}
          </span>
          <TogglePill
            options={["☀", "☾"]}
            active={theme === "light" ? "☀" : "☾"}
            onSelect={(v) => { if ((v === "☀") !== (theme === "light")) toggleTheme() }}
          />
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px" }}>
          <span className="dot dot-green" />
          <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Connected</span>
        </div>
      </div>
    </aside>
  )
}

/* Reusable 2-option pill toggle */
function TogglePill({
  options,
  active,
  onSelect,
}: {
  options: [string, string]
  active: string
  onSelect: (val: string) => void
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: "var(--bg-2)",
      border: "1px solid var(--border-md)",
      borderRadius: 99, padding: "2px 3px", gap: 2,
      transition: "background var(--t) var(--ease)",
    }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 20,
            borderRadius: 99, border: "none",
            fontSize: "0.72rem",
            background: active === opt ? "var(--bg)" : "transparent",
            color: active === opt ? "var(--text)" : "var(--text-3)",
            boxShadow: active === opt ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            cursor: "pointer",
            transition: "all var(--t) var(--ease)",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}