// app/api/leads/[id]/convert/route.ts
//
// POST — converts a lead to a client atomically.
// Called by PipelineBoard when a card is dragged to the Client column.
// Wraps convertLeadToClient so the service client stays server-side.

import { NextRequest, NextResponse } from "next/server"
import { convertLeadToClient } from "@/lib/conversion"

export const dynamic = "force-dynamic"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing lead id" }, { status: 400 })
  }

  try {
    const client = await convertLeadToClient(id)
    return NextResponse.json({ ok: true, client })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Conversion failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}