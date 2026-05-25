"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resolveAutomation } from "@/lib/automationActions"

export default function DismissAlert({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDismiss = async () => {
    setLoading(true)
    await resolveAutomation(id)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={loading}
      className="btn btn-ghost btn-danger"
      style={{ padding: "2px 8px", fontSize: "0.72rem" }}
      title="Dismiss alert"
    >
      {loading ? "…" : "Dismiss"}
    </button>
  )
}
