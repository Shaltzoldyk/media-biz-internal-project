// app/api/clients/[id]/route.ts
//
// DELETE — removes a client and their revenue records.
// Revenue records are deleted first to satisfy the FK constraint.
// Uses service client — anon role has no DELETE on clients or revenue_records per RLS.

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer as supabase } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: "Missing client id" }, { status: 400 })

  // Delete revenue records first (FK constraint)
  const { error: revenueError } = await supabase
    .from("revenue_records")
    .delete()
    .eq("client_id", id)

  if (revenueError) {
    console.error("Revenue records delete failed:", revenueError.message)
    return NextResponse.json({ ok: false, error: revenueError.message }, { status: 500 })
  }

  const { error: clientError } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)

  if (clientError) {
    console.error("Client delete failed:", clientError.message)
    return NextResponse.json({ ok: false, error: clientError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}