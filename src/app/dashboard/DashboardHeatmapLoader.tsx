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
                const res = await fetch("/api/workload/heatmap?stream=1", { cache: "no-store" })
                if (!res.ok || !res.body) {
                    throw new Error("Failed to stream heatmap")
                }

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ""

                while (!cancelled) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })

                    let newLineIndex = buffer.indexOf("\n")
                    while (newLineIndex >= 0) {
                        const rawLine = buffer.slice(0, newLineIndex).trim()
                        buffer = buffer.slice(newLineIndex + 1)
                        newLineIndex = buffer.indexOf("\n")

                        if (!rawLine) continue

                        let event: any = null
                        try {
                            event = JSON.parse(rawLine)
                        } catch {
                            continue
                        }

                        if (event?.type === "meta") {
                            setData((prev) => ({
                                ...prev,
                                criticalIssues: Array.isArray(event.criticalIssues) ? event.criticalIssues : [],
                                overloadedUsers: Array.isArray(event.overloadedUsers) ? event.overloadedUsers : [],
                                idleUsers: Array.isArray(event.idleUsers) ? event.idleUsers : [],
                                allTasks: Array.isArray(event.allTasks) ? event.allTasks : [],
                                projects: Array.isArray(event.projects) ? event.projects : []
                            }))
                            setHasMeta(true)
                            setLoading(false)
                            continue
                        }

                        if (event?.type === "user" && event.userStat) {
                            setData((prev) => ({
                                ...prev,
                                userStats: [...prev.userStats, event.userStat]
                            }))
                            setHasMeta(true)
                            setLoading(false)
                            continue
                        }
                    }
                }

                if (!cancelled && buffer.trim()) {
                    try {
                        const tailEvent = JSON.parse(buffer.trim())
                        if (tailEvent?.type === "user" && tailEvent.userStat) {
                            setData((prev) => ({
                                ...prev,
                                userStats: [...prev.userStats, tailEvent.userStat]
                            }))
                            setHasMeta(true)
                        } else if (tailEvent?.type === "meta") {
                            setData((prev) => ({
                                ...prev,
                                criticalIssues: Array.isArray(tailEvent.criticalIssues) ? tailEvent.criticalIssues : [],
                                overloadedUsers: Array.isArray(tailEvent.overloadedUsers) ? tailEvent.overloadedUsers : [],
                                idleUsers: Array.isArray(tailEvent.idleUsers) ? tailEvent.idleUsers : [],
                                allTasks: Array.isArray(tailEvent.allTasks) ? tailEvent.allTasks : [],
                                projects: Array.isArray(tailEvent.projects) ? tailEvent.projects : []
                            }))
                            setHasMeta(true)
                        }
                    } catch {
                        // ignore malformed trailing payload
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
