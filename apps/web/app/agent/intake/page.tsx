"use client"
import PublicIntake from '../../intake/[linkId]/page'

export default function AgentIntake() {
  // Reuse the same schema component; pass a fixed linkId for demo
  return <PublicIntake params={{ linkId: 'lnk_1' }} />
}


