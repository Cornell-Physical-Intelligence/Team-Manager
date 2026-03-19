import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { fetchHeatmapWidgetData } from "@/lib/convex/dashboard"
import { buildWorkloadTasks, computeWorkloadStats, normalizeWorkloadConfig } from "@/lib/workload"

export async function GET() {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    try {
        const { config: workloadConfig, memberships, tasks, projects } = await fetchHeatmapWidgetData({
            workspaceId: user.workspaceId,
        })

        const config = normalizeWorkloadConfig(workloadConfig)

        const users = memberships.map((member) => ({
            id: member.userId,
            name: member.name || member.user.name,
            avatar: member.user.avatar,
            role: member.role,
        }))

        const now = new Date()

        const workloadTasks = buildWorkloadTasks(
            tasks.map((task) => ({
                ...task,
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                endDate: task.endDate ? new Date(task.endDate) : null,
                startDate: task.startDate ? new Date(task.startDate) : null,
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
        const sortedUserStats = [...userStats].sort((a, b) => b.activeTasks - a.activeTasks)

        const criticalIssues: { type: string; severity: "critical" | "warning" | "info"; message: string; count: number; tasks: typeof workloadTasks }[] = []

        const totalOverdue = workloadTasks.filter((t) => t.isOverdue).length
        const totalStuck = workloadTasks.filter((t) => t.isStuck).length
        const totalUnassigned = workloadTasks.filter((t) => t.isUnassigned).length

        if (totalOverdue > 0) {
            criticalIssues.push({ type: "overdue", severity: "critical", message: `${totalOverdue} tasks are overdue`, count: totalOverdue, tasks: workloadTasks.filter((t) => t.isOverdue) })
        }
        if (totalStuck > 0) {
            criticalIssues.push({ type: "stuck", severity: "warning", message: `${totalStuck} tasks stuck (${config.thresholds.stuckDays}+ days)`, count: totalStuck, tasks: workloadTasks.filter((t) => t.isStuck) })
        }
        if (totalUnassigned > 0) {
            criticalIssues.push({ type: "unassigned", severity: "info", message: `${totalUnassigned} tasks unassigned`, count: totalUnassigned, tasks: workloadTasks.filter((t) => t.isUnassigned) })
        }

        return NextResponse.json({
            userStats: sortedUserStats,
            criticalIssues,
            overloadedUsers,
            idleUsers,
            allTasks: workloadTasks,
            projects,
        })
    } catch (error) {
        console.error("Failed to load heatmap data:", error)
        return NextResponse.json({ error: "Failed to load heatmap data" }, { status: 500 })
    }
}
