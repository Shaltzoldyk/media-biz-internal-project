// lib/automationActions.ts
//
// Called by DismissAlert and ResolveAlertButton ("use client" components).
// Must NEVER import server-only modules (supabase, supabaseServer).
// Delegates the DB write to /api/alerts/[id]/resolve so the service role
// key stays server-side.

export async function resolveAutomation(id: string) {
  const res = await fetch(`/api/alerts/${id}/resolve`, { method: "POST" })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.error("Failed to resolve automation:", body.error ?? res.status)
  }
}