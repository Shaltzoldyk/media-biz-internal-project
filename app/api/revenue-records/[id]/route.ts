// app/api/revenue-records/[id]/route.ts
//
// DELETE — removes one revenue record.
// Anon role has SELECT-only on revenue_records per RLS — service client required.

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as supabase } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: "Missing record id" }, { status: 400 })

  const { error } = await supabase.from("revenue_records").delete().eq("id", id)
  if (error) {
    console.error("Revenue record delete failed:", error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}