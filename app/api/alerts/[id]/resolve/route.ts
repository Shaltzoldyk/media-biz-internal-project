// app/api/alerts/[id]/resolve/route.ts

import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // Next.js 15+: params is a Promise
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing alert id" }, { status: 400 })
  }

  const { error } = await supabaseServer
    .from("automations_log")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    console.error("Failed to resolve automation:", error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}