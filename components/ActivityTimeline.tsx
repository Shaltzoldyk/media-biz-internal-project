"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Activity = {
  id: string
  type: string
  metadata: any
  created_at: string
}

function formatType(type: string) {
  return type.replaceAll("_", " ")
}

export default function ActivityTimeline({
  entityType,
  entityId,
}: {
  entityType: "lead" | "client"
  entityId: string
}) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })

      setActivities(data || [])
      setLoading(false)
    }

    fetchActivities()
  }, [entityType, entityId])

  if (loading) {
    return (
      <div className="mt-6 text-sm text-zinc-500">
        Loading activity...
      </div>
    )
  }

  if (!activities.length) {
    return (
      <div className="mt-6 text-sm text-zinc-500">
        No activity yet.
      </div>
    )
  }

  return (
    <div className="mt-6 border-t border-zinc-800 pt-4 space-y-3">
      <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
        Activity
      </div>

      {activities.map((activity) => (
        <div
          key={activity.id}
          className="bg-zinc-800 p-3 rounded text-sm"
        >
          <div className="flex justify-between">
            <div className="font-medium capitalize">
              {formatType(activity.type)}
            </div>
            <div className="text-xs text-zinc-500">
              {new Date(activity.created_at).toLocaleString()}
            </div>
          </div>

          {activity.metadata && (
            <pre className="text-xs text-zinc-500 mt-2 whitespace-pre-wrap">
              {JSON.stringify(activity.metadata, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
