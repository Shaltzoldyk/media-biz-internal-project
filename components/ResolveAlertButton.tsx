"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resolveAutomation } from "@/lib/automationActions"

export default function ResolveAlertButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleResolve = async () => {
    setLoading(true)
    await resolveAutomation(id)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleResolve}
      disabled={loading}
      className="btn btn-ghost"
      style={{ padding: "2px 8px", fontSize: "0.72rem" }}
      title="Mark as resolved"
    >
      {loading ? "…" : "Resolve"}
    </button>
  )
}
