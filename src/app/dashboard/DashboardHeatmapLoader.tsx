"use client"

import { Loader2 } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { DashboardHeatmap } from "./DashboardHeatmap"
import { buildWorkloadTasks, computeWorkloadStats, normalizeWorkloadConfig } from "@/lib/workload"

export function DashboardHeatmapLoader({
    workspaceId,
}: {
    workspaceId: string
}) {
    const payload = useQuery(api.dashboard.getHeatmapWidgetData, { workspaceId })

    if (payload === undefined) {
        return (
            <section className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading work distribution…
                </div>
            </section>
        )
    }

    const config = normalizeWorkloadConfig(payload.config)
    const users = payload.memberships.map((member) => ({
        id: member.userId,
        name: member.name || member.user.name,
        avatar: member.user.avatar,
        role: member.role,
    }))

    const now = new Date()
    const workloadTasks = buildWorkloadTasks(
        payload.tasks.map((task) => ({
            ...task,
            dueDate: null,
            endDate: null,
            startDate: null,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            submittedAt: task.submittedAt ? new Date(task.submittedAt) : null,
            approvedAt: task.approvedAt ? new Date(task.approvedAt) : null,
            activityLogs: task.activityLogs.map((log) => ({
                ...log,
                createdAt: new Date(log.createdAt),
            })),
        })),
        now,
        config
    )

    const { userStats, overloadedUsers, idleUsers } = computeWorkloadStats(users, workloadTasks, config, now)

    const criticalIssues: {
        type: string
        severity: "critical" | "warning" | "info"
        message: string
        count: number
        tasks: typeof workloadTasks
    }[] = []

    const totalOverdue = workloadTasks.filter((task) => task.isOverdue).length
    const totalStuck = workloadTasks.filter((task) => task.isStuck).length
    const totalUnassigned = workloadTasks.filter((task) => task.isUnassigned).length

    if (totalOverdue > 0) {
        criticalIssues.push({
            type: "overdue",
            severity: "critical",
            message: `${totalOverdue} tasks are overdue`,
            count: totalOverdue,
            tasks: workloadTasks.filter((task) => task.isOverdue),
        })
    }

    if (totalStuck > 0) {
        criticalIssues.push({
            type: "stuck",
            severity: "warning",
            message: `${totalStuck} tasks stuck (${config.thresholds.stuckDays}+ days)`,
            count: totalStuck,
            tasks: workloadTasks.filter((task) => task.isStuck),
        })
    }

    if (totalUnassigned > 0) {
        criticalIssues.push({
            type: "unassigned",
            severity: "info",
            message: `${totalUnassigned} tasks unassigned`,
            count: totalUnassigned,
            tasks: workloadTasks.filter((task) => task.isUnassigned),
        })
    }

    if (userStats.length === 0) {
        return null
    }

    return (
        <DashboardHeatmap
            userStats={userStats}
            criticalIssues={criticalIssues}
            overloadedUsers={overloadedUsers}
            idleUsers={idleUsers}
            allTasks={workloadTasks}
            projects={payload.projects}
        />
    )
}
