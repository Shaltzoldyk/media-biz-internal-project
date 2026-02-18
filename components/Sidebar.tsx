"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { name: "Today", path: "/today" },
  { name: "Dashboard", path: "/" },

  // Core Acquisition
  { name: "Leads", path: "/leads" },
  { name: "Pipeline", path: "/pipeline" },

  // Revenue
  { name: "Clients", path: "/clients" },

  // System Memory
  { name: "Activity", path: "/activity" },

  // Analytics
  { name: "Analytics", path: "/analytics" },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="w-64 h-screen bg-zinc-900 text-white p-6 border-r border-zinc-800">
      <h1 className="text-xl font-semibold mb-8">
        Lead OS
      </h1>

      <nav className="space-y-3">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`block px-3 py-2 rounded-md transition ${
              isActive(item.path)
                ? "bg-zinc-700"
                : "hover:bg-zinc-800"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  )
}
