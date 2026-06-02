// app/api/leads/[id]/route.ts
//
// PATCH — update any lead fields (status, follow_up_date, stage_changed_at, etc.)
// DELETE — permanently delete a lead
//
// Both require the service client — anon role has no UPDATE/DELETE on leads per RLS.

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as supabase } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: "Missing lead id" }, { status: 400 })

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }) }

  const { patch } = body
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ ok: false, error: "Body must include a patch object" }, { status: 400 })
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", id)
  if (error) {
    console.error("Lead update failed:", error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: "Missing lead id" }, { status: 400 })

  const { error } = await supabase.from("leads").delete().eq("id", id)
  if (error) {
    console.error("Lead delete failed:", error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}