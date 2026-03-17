import { getCurrentUser } from '@/lib/auth'
import { buildWorkloadTasks, computeWorkloadStats, normalizeWorkloadConfig } from '@/lib/workload'
import { fetchDashboardHeatmapPageData } from "@/lib/convex/dashboard"
import { redirect } from "next/navigation"
import { HeatmapView } from "./HeatmapView"

export const dynamic = 'force-dynamic'

export default async function HeatmapPage() {
    const user = await getCurrentUser()

    if (!user || !user.id || user.id === 'pending') {
        return <div className="p-6 text-muted-foreground">Please complete your profile setup.</div>
    }

    // Only admins and team leads can view the heatmap
    if (user.role !== 'Admin' && user.role !== 'Team Lead') {
        redirect('/dashboard')
    }

    if (!user.workspaceId) {
        return <div className="p-6 text-muted-foreground">Workspace not found.</div>
    }

    const { config: workloadConfig, memberships, tasks, projects } = await fetchDashboardHeatmapPageData({
        workspaceId: user.workspaceId,
    })

    const config = normalizeWorkloadConfig(workloadConfig)

    const users = memberships.map((member) => ({
        id: member.userId,
        name: member.name || member.user.name,
        avatar: member.user.avatar,
        role: member.role
    }))

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

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
            helpRequests: task.helpRequests.map((request) => ({
                ...request,
                createdAt: new Date(request.createdAt),
            })),
            activityLogs: task.activityLogs.map((log) => ({
                ...log,
                createdAt: new Date(log.createdAt),
            })),
        })),
        now,
        config
    )
    const { userStats, overloadedUsers, idleUsers } = computeWorkloadStats(users, workloadTasks, config, now)

    const transformedTasks = workloadTasks.map(task => ({
        id: task.id,
        title: task.title,
        columnName: task.columnName,
        columnId: task.columnId,
        projectId: task.projectId,
        projectName: task.projectName,
        projectColor: task.projectColor,
        pushId: task.pushId,
        pushName: task.pushName,
        assigneeIds: task.assigneeIds,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        isOverdue: task.isOverdue,
        daysUntilDue: task.daysUntilDue,
        daysSinceActivity: task.daysSinceActivity,
        isStuck: task.isStuck,
        isBlockedByHelp: task.isBlockedByHelp,
        isUnassigned: task.isUnassigned,
        helpRequestStatus: task.isBlockedByHelp ? 'open' : null,
        checklistTotal: task.checklistTotal,
        checklistCompleted: task.checklistCompleted,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
    }))

    const taskMap = new Map(transformedTasks.map(task => [task.id, task]))
    const userStatsForView = userStats.map(user => ({
        ...user,
        tasks: user.tasks
            .map(task => taskMap.get(task.id))
            .filter((task): task is (typeof transformedTasks)[number] => Boolean(task))
    }))

    // Global bottleneck stats
    const bottlenecks = {
        totalOverdue: transformedTasks.filter(t => t.isOverdue && t.columnName !== 'Done').length,
        totalStuck: transformedTasks.filter(t => t.isStuck).length,
        totalUnassigned: transformedTasks.filter(t => t.isUnassigned).length,
        totalHelpRequests: transformedTasks.filter(t => t.isBlockedByHelp).length,
        tasksInReview: transformedTasks.filter(t => t.columnName === 'Review').length,
        overdueThisWeek: transformedTasks.filter(t => {
            if (!t.dueDate || t.columnName === 'Done') return false
            const due = new Date(t.dueDate)
            return due >= sevenDaysAgo && due < now
        }).length
    }

    // Identify critical bottlenecks
    const criticalIssues: { type: string; severity: 'critical' | 'warning' | 'info'; message: string; count: number; tasks: typeof transformedTasks }[] = []

    if (bottlenecks.totalOverdue > 0) {
        criticalIssues.push({
            type: 'overdue',
            severity: 'critical',
            message: `${bottlenecks.totalOverdue} tasks are overdue`,
            count: bottlenecks.totalOverdue,
            tasks: transformedTasks.filter(t => t.isOverdue && t.columnName !== 'Done')
        })
    }

    if (bottlenecks.totalStuck > 0) {
        criticalIssues.push({
            type: 'stuck',
            severity: 'warning',
            message: `${bottlenecks.totalStuck} tasks stuck in progress (no activity for ${config.thresholds.stuckDays}+ days)`,
            count: bottlenecks.totalStuck,
            tasks: transformedTasks.filter(t => t.isStuck)
        })
    }

    if (bottlenecks.totalHelpRequests > 0) {
        criticalIssues.push({
            type: 'help',
            severity: 'warning',
            message: `${bottlenecks.totalHelpRequests} tasks need help`,
            count: bottlenecks.totalHelpRequests,
            tasks: transformedTasks.filter(t => t.isBlockedByHelp)
        })
    }

    if (bottlenecks.totalUnassigned > 0) {
        criticalIssues.push({
            type: 'unassigned',
            severity: 'info',
            message: `${bottlenecks.totalUnassigned} tasks are unassigned`,
            count: bottlenecks.totalUnassigned,
            tasks: transformedTasks.filter(t => t.isUnassigned)
        })
    }

    if (bottlenecks.tasksInReview > 5) {
        criticalIssues.push({
            type: 'review_queue',
            severity: 'warning',
            message: `${bottlenecks.tasksInReview} tasks waiting for review`,
            count: bottlenecks.tasksInReview,
            tasks: transformedTasks.filter(t => t.columnName === 'Review')
        })
    }

    if (overloadedUsers.length > 0) {
        criticalIssues.push({
            type: 'overloaded',
            severity: 'warning',
            message: `${overloadedUsers.length} team members are overloaded`,
            count: overloadedUsers.length,
            tasks: []
        })
    }

    return (
        <div className="h-full flex flex-col">
            <HeatmapView
                userStats={userStatsForView}
                bottlenecks={bottlenecks}
                criticalIssues={criticalIssues}
                projects={projects.map(p => ({
                    id: p.id,
                    name: p.name,
                    color: p.color || '#6b7280',
                    leadNames: p.leadAssignments.map((assignment) => assignment.user.name)
                }))}
                overloadedUsers={overloadedUsers}
                idleUsers={idleUsers}
                allTasks={transformedTasks}
            />
        </div>
    )
}
