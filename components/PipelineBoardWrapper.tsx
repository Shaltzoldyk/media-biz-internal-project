"use client"

import dynamic from "next/dynamic"
import { Lead } from "@/types/lead"

const PipelineBoard = dynamic(
  () => import("./PipelineBoard"),
  { ssr: false }
)

export default function PipelineBoardWrapper({
  leads,
}: {
  leads: Lead[]
}) {
  return <PipelineBoard leads={leads} />
}
