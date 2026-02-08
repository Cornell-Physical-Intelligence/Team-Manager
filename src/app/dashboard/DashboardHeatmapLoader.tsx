"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { DashboardHeatmap } from "./DashboardHeatmap"

type HeatmapResponse = {
    userStats: any[]
    criticalIssues: any[]
    overloadedUsers: any[]
    idleUsers: any[]
    allTasks: any[]
    projects: any[]
}

type HeatmapSummaryResponse = {
    userIds: string[]
    criticalIssues: any[]
    overloadedUsers: any[]
    idleUsers: any[]
    allTasks: any[]
    projects: any[]
}

export function DashboardHeatmapLoader() {
    const [data, setData] = useState<HeatmapResponse>({
        userStats: [],
        criticalIssues: [],
        overloadedUsers: [],
        idleUsers: [],
        allTasks: [],
        projects: []
    })
    const [loading, setLoading] = useState(true)
    const [hasMeta, setHasMeta] = useState(false)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const summaryRes = await fetch("/api/workload/heatmap?summary=1", { cache: "no-store" })
                const summaryPayload = await summaryRes.json() as HeatmapSummaryResponse
                if (!summaryRes.ok) {
                    throw new Error("Failed to load workload summary")
                }

                const userIds = Array.isArray(summaryPayload?.userIds) ? summaryPayload.userIds : []
                if (cancelled) return

                setData((prev) => ({
                    ...prev,
                    criticalIssues: Array.isArray(summaryPayload?.criticalIssues) ? summaryPayload.criticalIssues : [],
                    overloadedUsers: Array.isArray(summaryPayload?.overloadedUsers) ? summaryPayload.overloadedUsers : [],
                    idleUsers: Array.isArray(summaryPayload?.idleUsers) ? summaryPayload.idleUsers : [],
                    allTasks: Array.isArray(summaryPayload?.allTasks) ? summaryPayload.allTasks : [],
                    projects: Array.isArray(summaryPayload?.projects) ? summaryPayload.projects : [],
                    userStats: []
                }))
                setHasMeta(true)
                setLoading(false)

                for (const userId of userIds) {
                    if (cancelled) return
                    try {
                        const userRes = await fetch(`/api/workload/heatmap?userId=${encodeURIComponent(userId)}`, {
                            cache: "no-store"
                        })
                        const userPayload = await userRes.json()
                        if (!userRes.ok || !userPayload?.userStat) continue

                        setData((prev) => {
                            if (prev.userStats.some((existingUser) => existingUser.id === userPayload.userStat.id)) {
                                return prev
                            }
                            return {
                                ...prev,
                                userStats: [...prev.userStats, userPayload.userStat]
                            }
                        })
                    } catch {
                        // Skip failed user card and continue loading remaining cards.
                    }
                }
            } catch {
                try {
                    const fallbackRes = await fetch("/api/workload/heatmap", { cache: "no-store" })
                    const payload = await fallbackRes.json()
                    if (!fallbackRes.ok) throw new Error(payload?.error || "Failed to load heatmap")
                    if (!cancelled) {
                        setData({
                            userStats: Array.isArray(payload?.userStats) ? payload.userStats : [],
                            criticalIssues: Array.isArray(payload?.criticalIssues) ? payload.criticalIssues : [],
                            overloadedUsers: Array.isArray(payload?.overloadedUsers) ? payload.overloadedUsers : [],
                            idleUsers: Array.isArray(payload?.idleUsers) ? payload.idleUsers : [],
                            allTasks: Array.isArray(payload?.allTasks) ? payload.allTasks : [],
                            projects: Array.isArray(payload?.projects) ? payload.projects : []
                        })
                        setHasMeta(true)
                    }
                } catch {
                    if (!cancelled) {
                        setData({
                            userStats: [],
                            criticalIssues: [],
                            overloadedUsers: [],
                            idleUsers: [],
                            allTasks: [],
                            projects: []
                        })
                        setHasMeta(false)
                    }
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [])

    if (loading && !hasMeta) {
        return (
            <section className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading work distribution…
                </div>
            </section>
        )
    }

    if (!hasMeta) {
        return null
    }

    return (
        <DashboardHeatmap
            userStats={data.userStats}
            criticalIssues={data.criticalIssues}
            overloadedUsers={data.overloadedUsers}
            idleUsers={data.idleUsers}
            allTasks={data.allTasks}
            projects={data.projects}
        />
    )
}
