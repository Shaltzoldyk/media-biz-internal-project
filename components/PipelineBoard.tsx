"use client"

import {
  DndContext,
  closestCenter,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core"

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

import { CSS } from "@dnd-kit/utilities"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Lead } from "@/types/lead"
import { getStageStatus } from "@/lib/stageVelocity"
import { convertLeadToClient } from "@/lib/conversion"
import { logActivity } from "@/lib/activity" // ✅ ADDED

const statuses = [
  "New",
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const leadId = active.id as string
    const newStatus = over.id as string

    if (!statuses.includes(newStatus)) return

    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === newStatus) return

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

    // ✅ Optimistic UI update
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

    const { error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", leadId)

    if (error) {
      // 🔁 Rollback UI
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: previousStatus } : l
        )
      )
      return
    }

    // ✅ LOG STATUS CHANGE (Phase 4 Activity Engine)
    await logActivity({
      entityType: "lead",
      entityId: leadId,
      type: "status_change",
      metadata: {
        from: previousStatus,
        to: newStatus,
      },
    })

    // 🔥 AUTO CONVERT WHEN MOVED TO CLIENT
    if (newStatus === "Client" && !lead.converted) {
      try {
        await convertLeadToClient(leadId)
      } catch (err) {
        console.error("Conversion failed:", err)

        // Rollback DB
        await supabase
          .from("leads")
          .update({ status: previousStatus })
          .eq("id", leadId)

        // Rollback UI
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: previousStatus } : l
          )
        )
      }
    }
  }

  const grouped = statuses.map((status) => {
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

  const totalPipelineValue = leads.reduce(
    (sum, lead) => sum + Number(lead.value || 0),
    0
  )

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="w-full">
        <div className="mb-6 text-xl font-semibold">
          Total Pipeline: ₹ {totalPipelineValue.toLocaleString()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {grouped.map((column) => (
            <DroppableColumn key={column.status} id={column.status}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 min-h-[400px]">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                    {column.status} ({column.count})
                  </h2>
                  <div className="text-xs text-zinc-500 mt-1">
                    ₹ {column.totalValue.toLocaleString()}
                  </div>
                </div>

                <SortableContext
                  items={column.leads.map((lead) => lead.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-zinc-800 p-3 rounded-lg border border-zinc-700 border-l-4 ${velocityColor} hover:border-zinc-500 transition cursor-grab`}
    >
      <div className="flex justify-between">
        <div className="font-medium">{lead.name}</div>
        <div className="text-xs">🔥 {lead.score || 0}/10</div>
      </div>

      <div className="text-sm text-zinc-400">
        {lead.platform || "-"}
      </div>

      <div className="text-sm text-zinc-500">
        {lead.subscriber_count
          ? lead.subscriber_count.toLocaleString()
          : "-"}
      </div>

      <div className="text-sm mt-1">
        ₹ {lead.value ? Number(lead.value).toLocaleString() : "-"}
      </div>
    </div>
  )
}
