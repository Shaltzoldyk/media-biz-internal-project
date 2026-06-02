// app/api/leads/[id]/activity/route.ts
//
// POST — logs an activity entry for a lead.
// Called by PipelineBoard after a confirmed status change.
// Wraps logActivity so the service client stays server-side.

import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/activity"

export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing lead id" }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  try {
    await logActivity({
      entityType: "lead",
      entityId:   id,
      type:       body.type,
      message:    body.message,
      severity:   body.severity,
      metadata:   body.metadata ?? {},
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Activity log failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}