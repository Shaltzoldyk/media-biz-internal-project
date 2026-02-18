"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { calculateLeadScore } from "@/lib/leadScore"
import { logActivity } from "@/lib/activity"

export default function NewLeadPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [platform, setPlatform] = useState("YouTube")
  const [subscribers, setSubscribers] = useState("")
  const [value, setValue] = useState("")
  const [warmIntro, setWarmIntro] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage("")

    const subscriberNumber = Number(subscribers) || 0
    const dealValue = Number(value) || 0

    const computedScore = calculateLeadScore({
      subscribers: subscriberNumber,
      outsourcing: false,
      uploadsWeekly: true,
      monetized: true,
      warmIntro,
    })

    const timestamp = new Date().toISOString()

    const { data: insertedLead, error } = await supabase
      .from("leads")
      .insert([
        {
          name,
          brand_name: brand || null,
          platform,
          subscriber_count: subscriberNumber,
          value: dealValue,
          score: computedScore,
          status: "New",
          stage_changed_at: timestamp,
          converted: false,
        },
      ])
      .select()
      .single()

    if (error || !insertedLead) {
      setErrorMessage("Failed to create lead.")
      setLoading(false)
      return
    }

    // ✅ Log lifecycle creation
    await logActivity({
      entityType: "lead",
      entityId: insertedLead.id,
      type: "lead_created",
      metadata: {
        name: insertedLead.name,
        platform: insertedLead.platform,
        value: insertedLead.value,
        score: insertedLead.score,
        warmIntro,
      },
    })

    router.push("/leads")
    router.refresh()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold mb-10">Add New Lead</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 text-white p-8 rounded-xl border border-zinc-800 space-y-6"
      >
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Brand Name</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
          >
            <option value="YouTube">YouTube</option>
            <option value="Twitter">Twitter</option>
            <option value="LinkedIn">LinkedIn</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Subscriber Count</label>
          <input
            type="number"
            value={subscribers}
            onChange={(e) => setSubscribers(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Deal Value (₹)</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={warmIntro}
            onChange={() => setWarmIntro(!warmIntro)}
            className="w-4 h-4"
          />
          <label className="text-sm text-zinc-400">
            Warm Introduction?
          </label>
        </div>

        {errorMessage && (
          <div className="text-red-400 text-sm">{errorMessage}</div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-zinc-100 text-black px-6 py-3 rounded-lg font-medium hover:bg-white transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  )
}
