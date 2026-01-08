"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
    AlertTriangle, Clock, HelpCircle, UserX, ChevronRight, Loader2,
    Users, Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

type Task = {
    id: string
    title: string
    columnName: string
    projectId: string
    projectColor: string
    pushId: string | null
    isOverdue: boolean
    isStuck: boolean
    isBlockedByHelp: boolean
}

type UserStat = {
    id: string
    name: string
    activeTasks: number
    overdueTasks: number
    stuckTasks: number
    helpRequestTasks: number
    workloadScore: number
}

type CriticalIssue = {
    type: string
    severity: 'critical' | 'warning' | 'info'
    message: string
    count: number
    tasks: Task[]
}

type DashboardHeatmapProps = {
    userStats: UserStat[]
    criticalIssues: CriticalIssue[]
    overloadedUsers: string[]
    idleUsers: string[]
}

function TaskListDialog({
    open,
    onOpenChange,
    title,
    tasks
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    tasks: Task[]
}) {
    const router = useRouter()
    const [navigating, setNavigating] = useState<string | null>(null)

    const handleClick = (task: Task) => {
        setNavigating(task.id)
        let url = `/dashboard/projects/${task.projectId}?task=${task.id}`
        if (task.pushId) url += `&push=${task.pushId}`
        router.push(url)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sm">{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
                    {tasks.map(task => (
                        <button
                            key={task.id}
                            onClick={() => handleClick(task)}
                            disabled={navigating === task.id}
                            className="w-full flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: task.projectColor }}
                                />
                                <span className="text-xs truncate">{task.title}</span>
                                <span className="text-[9px] text-muted-foreground shrink-0">
                                    {task.columnName}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {task.isOverdue && (
                                    <span className="text-[9px] text-red-500">Overdue</span>
                                )}
                                {task.isStuck && (
                                    <span className="text-[9px] text-amber-500">Stuck</span>
                                )}
                                {task.isBlockedByHelp && (
                                    <HelpCircle className="h-3 w-3 text-amber-500" />
                                )}
                                {navigating === task.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                )}
                            </div>
                        </button>
                    ))}
                    {tasks.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function DashboardHeatmap({
    userStats,
    criticalIssues,
    overloadedUsers,
    idleUsers
}: DashboardHeatmapProps) {
    const [selectedIssue, setSelectedIssue] = useState<CriticalIssue | null>(null)

    const maxWorkload = Math.max(...userStats.map(u => u.workloadScore), 1)

    // Sort users by workload
    const sortedUsers = [...userStats].sort((a, b) => b.workloadScore - a.workloadScore).slice(0, 8)

    if (criticalIssues.length === 0 && userStats.length === 0) {
        return null
    }

    return (
        <section className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Team Heatmap
                </h2>
            </div>

            {/* Critical Issues */}
            {criticalIssues.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {criticalIssues.slice(0, 4).map((issue, i) => (
                        <button
                            key={i}
                            onClick={() => issue.tasks.length > 0 && setSelectedIssue(issue)}
                            className={cn(
                                "p-2 rounded-md border text-left transition-colors",
                                issue.severity === 'critical' && "bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50",
                                issue.severity === 'warning' && "bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50",
                                issue.severity === 'info' && "bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-900/50"
                            )}
                        >
                            <div className="flex items-center gap-1.5">
                                {issue.type === 'overdue' && <Clock className="h-3 w-3 text-red-500" />}
                                {issue.type === 'stuck' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                {issue.type === 'help' && <HelpCircle className="h-3 w-3 text-amber-500" />}
                                {issue.type === 'unassigned' && <UserX className="h-3 w-3 text-blue-500" />}
                                {issue.type === 'overloaded' && <Zap className="h-3 w-3 text-amber-500" />}
                                <span className={cn(
                                    "text-sm font-bold",
                                    issue.severity === 'critical' && "text-red-600",
                                    issue.severity === 'warning' && "text-amber-600",
                                    issue.severity === 'info' && "text-blue-600"
                                )}>
                                    {issue.count}
                                </span>
                                <span className="text-[9px] text-muted-foreground truncate">
                                    {issue.type === 'overdue' && 'overdue'}
                                    {issue.type === 'stuck' && 'stuck'}
                                    {issue.type === 'help' && 'need help'}
                                    {issue.type === 'unassigned' && 'unassigned'}
                                    {issue.type === 'overloaded' && 'overloaded'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Workload bars */}
            <div className="space-y-1.5">
                {sortedUsers.map(user => {
                    const isOverloaded = overloadedUsers.includes(user.id)
                    const isIdle = idleUsers.includes(user.id)
                    const workloadRatio = user.workloadScore / maxWorkload

                    return (
                        <div key={user.id} className="flex items-center gap-2">
                            <div className="w-20 truncate text-[10px] text-muted-foreground">
                                {user.name.split(' ')[0]}
                            </div>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        workloadRatio < 0.4 ? "bg-green-500" :
                                            workloadRatio < 0.7 ? "bg-yellow-500" :
                                                workloadRatio < 0.85 ? "bg-orange-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${Math.min(workloadRatio * 100, 100)}%` }}
                                />
                            </div>
                            <div className="w-12 text-right">
                                {isOverloaded && (
                                    <span className="text-[9px] text-red-500">High</span>
                                )}
                                {isIdle && (
                                    <span className="text-[9px] text-green-500">Free</span>
                                )}
                                {!isOverloaded && !isIdle && (
                                    <span className="text-[9px] text-muted-foreground">{user.activeTasks}</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Task List Dialog */}
            <TaskListDialog
                open={!!selectedIssue}
                onOpenChange={() => setSelectedIssue(null)}
                title={selectedIssue?.message || ''}
                tasks={selectedIssue?.tasks || []}
            />
        </section>
    )
}
