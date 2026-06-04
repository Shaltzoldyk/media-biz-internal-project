"use client"

import {
  DndContext,
  closestCorners,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core"

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

import { CSS } from "@dnd-kit/utilities"
import { useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Lead } from "@/types/lead"
import { getStageStatus } from "@/lib/stageVelocity"
import { useCurrency } from "@/context/CurrencyContext"

const statuses = [
  "New",
  "Outreach",    // YT-sourced leads land here; automation watches for stall
  "Qualified",
  "Contacted",
  "Responded",
  "Call Booked",
  "Client",
  "Lost",
]

export default function PipelineBoard({
  leads: initialLeads,
}: {
  leads: Lead[]
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const { fmt } = useCurrency()

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const leadId = String(active.id)
    const newStatus = String(over.id)

    // 🔒 Guard 1: Ensure valid stage
    if (!statuses.includes(newStatus)) {
      console.warn("Invalid drop target:", newStatus)
      return
    }

    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    // 🔒 Guard 2: Prevent redundant update
    if (lead.status === newStatus) return

    const previousStatus = lead.status
    const timestamp = new Date().toISOString()

    const updatePayload: any = {
      status: newStatus,
      stage_changed_at: timestamp,
    }

    if (
      newStatus === "Contacted" ||
      newStatus === "Responded" ||
      newStatus === "Call Booked"
    ) {
      updatePayload.last_contacted_at = timestamp
    }

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              status: newStatus,
              stage_changed_at: timestamp,
              last_contacted_at:
                updatePayload.last_contacted_at || l.last_contacted_at,
            }
          : l
      )
    )

    const updateRes = await fetch(`/api/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patch: updatePayload }) })
    const updateData = await updateRes.json().catch(() => ({}))
    const error = updateRes.ok ? null : { message: updateData.error ?? "Update failed" }

    if (error) {
      // Rollback UI
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: previousStatus } : l
        )
      )
      return
    }

    // 🔒 Guard 3: Log only after confirmed DB update
    try {
      await fetch(`/api/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "status_change", metadata: { from: previousStatus, to: newStatus } }),
      })
    } catch (err) {
      console.error("Activity logging failed:", err)
    }

    // 🔥 Auto-convert to client if needed
    if (newStatus === "Client" && !lead.converted) {
      try {
        const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" })
        if (!res.ok) { const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Conversion failed") }
      } catch (err) {
        console.error("Conversion failed:", err)

        // Rollback DB
        await fetch(`/api/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patch: { status: previousStatus } }) })

        // Rollback UI
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: previousStatus } : l
          )
        )
      }
    }
  }

  const grouped = useMemo(() => {
    return statuses.map((status) => {
      const columnLeads = leads
        .filter((lead) => lead.status === status)
        .sort((a, b) => (b.score || 0) - (a.score || 0))

      const totalValue = columnLeads.reduce(
        (sum, lead) => sum + Number(lead.value || 0),
        0
      )

      return {
        status,
        leads: columnLeads,
        count: columnLeads.length,
        totalValue,
      }
    })
  }, [leads])

  const totalPipelineValue = leads.reduce(
    (sum, lead) => sum + Number(lead.value || 0),
    0
  )

  return (
    <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="w-full">
        <div className="mb-6 text-xl font-semibold">
          Total Pipeline: {fmt(totalPipelineValue)}
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-6 min-w-max pb-4">
            {grouped.map((column) => (
              <DroppableColumn key={column.status} id={column.status}>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-[340px] min-w-[340px] max-h-[75vh] flex flex-col">

                  {/* Sticky Header */}
                  <div className="sticky top-0 bg-zinc-900 z-10 pb-4">
                    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      {column.status} ({column.count})
                    </h2>
                    <div className="text-xs text-zinc-500 mt-1">
                      {fmt(column.totalValue)}
                    </div>
                  </div>

                  <SortableContext
                    items={column.leads.map((lead) => lead.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {column.leads.map((lead) => (
                        <SortableLeadCard key={lead.id} lead={lead} />
                      ))}

                      {column.leads.length === 0 && (
                        <div className="text-zinc-600 text-sm">
                          No leads
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DroppableColumn>
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  )
}

function DroppableColumn({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div ref={setNodeRef} id={id}>
      {children}
    </div>
  )
}

function SortableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: lead.id })
  const { fmt } = useCurrency()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const velocity = getStageStatus(lead.stage_changed_at)

  const velocityColor =
    velocity === "green"
      ? "border-l-green-500"
      : velocity === "yellow"
      ? "border-l-yellow-500"
      : "border-l-red-500"

  const daysInStage = lead.stage_changed_at
    ? Math.floor((Date.now() - new Date(lead.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const daysColor =
    velocity === "green"  ? "text-green-400"
    : velocity === "yellow" ? "text-yellow-400"
    : "text-red-400"

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-700 border-l-4 ${velocityColor} hover:border-zinc-500 transition cursor-grab`}
    >
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium truncate">
          {lead.name}
        </div>
        {/* Days in stage — same colour as the velocity border so they read as one signal */}
        {daysInStage !== null && (
          <div className={`text-xs font-mono flex-shrink-0 ml-1 ${daysColor}`}>
            {daysInStage}d
          </div>
        )}
      </div>

      <div className="text-xs text-zinc-400 mt-1 truncate">
        {lead.platform || "-"} •{" "}
        {lead.subscriber_count
          ? lead.subscriber_count.toLocaleString()
          : "-"}
      </div>

      <div className="flex justify-between items-center mt-1">
        <div className="text-xs">{fmt(lead.value)}</div>
        <div className="text-xs text-zinc-500">🔥 {lead.score || 0}/10</div>
      </div>
    </div>
  )
}