"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCurrency } from "@/context/CurrencyContext"

const nav = [
  { group: "Workspace", items: [
    { name: "Today",     href: "/today" },
    { name: "Dashboard", href: "/" },
  ]},
  { group: "Pipeline", items: [
    { name: "Leads",    href: "/leads" },
    { name: "Pipeline", href: "/pipeline" },
  ]},
  { group: "Revenue", items: [
    { name: "Clients",   href: "/clients" },
    { name: "Analytics", href: "/analytics" },
  ]},
  { group: "Log", items: [
    { name: "Activity", href: "/activity" },
  ]},
]

export default function Sidebar() {
  const path = usePathname()
  const { currency, toggle } = useCurrency()

  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href)

  return (
    <aside style={{
      width: 210,
      minWidth: 210,
      height: "100vh",
      position: "sticky",
      top: 0,
      background: "var(--bg)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 12px",
    }}>

      {/* Logo */}
      <div style={{
        padding: "4px 8px 20px",
        borderBottom: "1px solid var(--border)",
        marginBottom: 16,
      }}>
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
                  display: "block",
                  padding: "6px 8px",
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

      {/* Footer — currency toggle + status */}
      <div style={{
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>

        {/* Currency toggle */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2px",
        }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Currency</span>

          <button
            onClick={toggle}
            aria-label={`Switch to ${currency === "INR" ? "USD" : "INR"}`}
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-2)",
              border: "1px solid var(--border-md)",
              borderRadius: 99,
              padding: "2px 3px",
              cursor: "pointer",
              gap: 2,
            }}
          >
            {(["INR", "USD"] as const).map((c) => (
              <span key={c} style={{
                display: "inline-block",
                padding: "3px 9px",
                borderRadius: 99,
                fontSize: "0.68rem",
                fontWeight: 500,
                background: currency === c ? "var(--bg)" : "transparent",
                color: currency === c ? "var(--text)" : "var(--text-3)",
                border: currency === c ? "1px solid var(--border-md)" : "1px solid transparent",
                transition: "all var(--t) var(--ease)",
                userSelect: "none",
              }}>
                {c === "INR" ? "₹" : "$"}
              </span>
            ))}
          </button>
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