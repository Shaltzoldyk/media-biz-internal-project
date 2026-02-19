"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

type Activity = {
  id: string
  entity_type: "lead" | "client"
  entity_id: string
  type: string
  message?: string | null
  severity?: "warning" | "high" | "critical" | null
  metadata: any
  created_at: string
}

/* ================================
   HELPERS
================================ */

function formatCurrency(amount: any) {
  if (!amount && amount !== 0) return ""
  return `₹ ${Number(amount).toLocaleString()}`
}

function formatActivity(activity: Activity) {
  // 🔥 If message exists (system_flag or future intelligent logs)
  if (activity.message) {
    return activity.message
  }

  const meta = activity.metadata || {}

  switch (activity.type) {
    case "lead_created":
      return `Lead created — ${meta.name || ""}`

    case "status_change":
      return `Status changed from "${meta.from}" to "${meta.to}"`

    case "follow_up":
      return `Follow-up updated → ${meta.newFollowUpDate || ""}`

    case "conversion":
      return activity.entity_type === "lead"
        ? "Lead converted to client"
        : "Client created from lead"

    case "contract_update":
      return `Contract updated → ${formatCurrency(
        meta.newValue
      )} (${meta.newBilling || ""})`

    case "payment_logged":
      return `Payment logged → ${formatCurrency(meta.amount)}`

    case "payment_deleted":
      return `Payment deleted → ${formatCurrency(meta.amount)}`

    case "note":
      if (meta.action === "lead_deleted") {
        return `Lead deleted — ${meta.name || ""}`
      }
      return "Note recorded"

    default:
      return activity.type.replaceAll("_", " ")
  }
}

function getSeverityStyles(
  severity: Activity["severity"]
) {
  switch (severity) {
    case "critical":
      return "bg-red-950 border-red-800"
    case "high":
      return "bg-yellow-950 border-yellow-800"
    case "warning":
      return "bg-orange-950 border-orange-800"
    default:
      return "bg-zinc-900 border-zinc-800"
  }
}

/* ================================
   COMPONENT
================================ */

export default function ActivityPage() {
  const [activities, setActivities] =
    useState<Activity[]>([])
  const [entityFilter, setEntityFilter] =
    useState("")
  const [typeFilter, setTypeFilter] =
    useState("")
  const [search, setSearch] = useState("")

  const fetchActivities = async () => {
    let query = supabase
      .from("activities")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(300)

    if (entityFilter) {
      query = query.eq(
        "entity_type",
        entityFilter
      )
    }

    if (typeFilter) {
      query = query.eq("type", typeFilter)
    }

    const { data } = await query
    setActivities(data || [])
  }

  useEffect(() => {
    fetchActivities()
  }, [entityFilter, typeFilter])

  const filtered = activities.filter(
    (a) => {
      if (!search) return true

      const lower =
        search.toLowerCase()

      return (
        a.entity_id
          .toLowerCase()
          .includes(lower) ||
        formatActivity(a)
          .toLowerCase()
          .includes(lower)
      )
    }
  )

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-3xl font-semibold">
        Activity Log
      </h1>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={entityFilter}
          onChange={(e) =>
            setEntityFilter(e.target.value)
          }
          className="bg-zinc-800 p-2 rounded"
        >
          <option value="">
            All Entities
          </option>
          <option value="lead">
            Lead
          </option>
          <option value="client">
            Client
          </option>
        </select>

        <input
          placeholder="Filter by type..."
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value)
          }
          className="bg-zinc-800 p-2 rounded"
        />

        <input
          placeholder="Search activity..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          className="bg-zinc-800 p-2 rounded flex-1"
        />
      </div>

      {/* Activity Feed */}
      <div className="space-y-3">
        {filtered.map((activity) => {
          const entityLink =
            activity.entity_type ===
            "lead"
              ? `/leads/${activity.entity_id}`
              : `/clients/${activity.entity_id}`

          return (
            <div
              key={activity.id}
              className={`border rounded-xl p-4 ${getSeverityStyles(
                activity.severity
              )}`}
            >
              <div className="flex justify-between">
                <div className="text-sm font-medium">
                  {formatActivity(
                    activity
                  )}
                </div>

                <div className="text-xs text-zinc-500">
                  {new Date(
                    activity.created_at
                  ).toLocaleString()}
                </div>
              </div>

              <div className="text-xs mt-2">
                <Link
                  href={entityLink}
                  className="text-blue-400 hover:underline"
                >
                  View{" "}
                  {
                    activity.entity_type
                  }
                </Link>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-zinc-500 text-sm">
            No activity found.
          </div>
        )}
      </div>
    </div>
  )
}
