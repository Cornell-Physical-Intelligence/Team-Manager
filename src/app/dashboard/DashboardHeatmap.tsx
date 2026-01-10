"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    AlertTriangle, Clock, HelpCircle, UserX, ChevronRight, Loader2,
    Users, Zap, Target, CheckCircle2, BarChart3, ChevronDown, Plus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

type Task = {
    id: string
    title: string
    columnName: string
    projectId: string
    projectName: string
    projectColor: string
    pushId: string | null
    assigneeIds: string[]
    isOverdue: boolean
    isStuck: boolean
    isBlockedByHelp: boolean
    isUnassigned: boolean
}

type UserStat = {
    id: string
    name: string
    avatar: string | null
    role: string
    activeTasks: number
    todoTasks: number
    inProgressTasks: number
    reviewTasks: number
    doneTasks: number
    overdueTasks: number
    stuckTasks: number
    helpRequestTasks: number
    workloadScore: number
    tasks: Task[]
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
    allTasks: Task[]
}

function getWorkloadColor(score: number, maxScore: number): string {
    const ratio = score / Math.max(maxScore, 1)
    if (ratio < 0.3) return 'bg-green-50/70 dark:bg-green-900/15'
    if (ratio < 0.5) return 'bg-green-100/60 dark:bg-green-800/20'
    if (ratio < 0.7) return 'bg-yellow-50/70 dark:bg-yellow-900/15'
    if (ratio < 0.85) return 'bg-orange-50/70 dark:bg-orange-900/15'
    return 'bg-red-50/70 dark:bg-red-900/15'
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

// Mini Kanban Column for user view
function MiniKanbanColumn({
    name,
    tasks,
    onTaskClick,
    maxVisible = 3
}: {
    name: string
    tasks: Task[]
    onTaskClick: (task: Task) => void
    maxVisible?: number
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const isDone = name === 'Done'
    const shouldCollapse = tasks.length > maxVisible
    const visibleTasks = isExpanded ? tasks : tasks.slice(0, maxVisible)
    const hiddenCount = tasks.length - maxVisible

    return (
        <div className={cn(
            "flex-1 min-w-0 rounded-md border p-2",
            isDone ? "bg-green-50/50 dark:bg-green-950/20" : "bg-muted/30"
        )}>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium">{name}</span>
                <span className={cn(
                    "text-[9px] px-1 py-0.5 rounded",
                    isDone ? "bg-green-100 text-green-700 dark:bg-green-900/50" : "bg-muted text-muted-foreground"
                )}>
                    {tasks.length}
                </span>
            </div>
            <div className="space-y-1">
                {visibleTasks.map(task => (
                    <button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className={cn(
                            "w-full text-left p-1.5 rounded text-[10px] border transition-colors",
                            isDone
                                ? "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-900/50"
                                : "bg-background hover:bg-muted/50"
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: task.projectColor }}
                            />
                            <span className="truncate">{task.title}</span>
                            {task.isOverdue && !isDone && (
                                <span className="text-[8px] text-red-500 shrink-0">!</span>
                            )}
                        </div>
                    </button>
                ))}
                {shouldCollapse && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-center gap-1 py-1 text-[9px] text-muted-foreground hover:text-foreground"
                    >
                        {isExpanded ? (
                            <>Show less</>
                        ) : (
                            <>
                                <span className="flex gap-0.5">
                                    <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                                    <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                                    <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                                </span>
                                +{hiddenCount}
                            </>
                        )}
                    </button>
                )}
                {tasks.length === 0 && (
                    <p className="text-[9px] text-muted-foreground text-center py-2">—</p>
                )}
            </div>
        </div>
    )
}

// User Kanban Dialog - shows mini kanban + assign button
function UserKanbanDialog({
    open,
    onOpenChange,
    user,
    unassignedTasks,
    onAssignClick
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: UserStat | null
    unassignedTasks: Task[]
    onAssignClick: () => void
}) {
    const router = useRouter()

    if (!user) return null

    const handleTaskClick = (task: Task) => {
        let url = `/dashboard/projects/${task.projectId}?task=${task.id}`
        if (task.pushId) url += `&push=${task.pushId}`
        router.push(url)
    }

    // Group tasks by column
    const todoTasks = user.tasks.filter(t => t.columnName === 'To Do')
    const inProgressTasks = user.tasks.filter(t => t.columnName === 'In Progress')
    const reviewTasks = user.tasks.filter(t => t.columnName === 'Review')
    const doneTasks = user.tasks.filter(t => t.columnName === 'Done')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-2">
                        <DialogTitle className="text-sm flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{user.name}'s Board</span>
                        </DialogTitle>
                        {unassignedTasks.length > 0 && (
                            <Button
                                size="sm"
                                onClick={onAssignClick}
                                className="h-7 text-xs shrink-0"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Assign Task</span>
                                <span className="sm:hidden">Assign</span>
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {/* Stats row */}
                <div className="flex items-center gap-2 sm:gap-4 py-2 text-[10px] text-muted-foreground border-b flex-wrap">
                    <span>{user.activeTasks} active</span>
                    {user.overdueTasks > 0 && (
                        <span className="text-red-500">{user.overdueTasks} overdue</span>
                    )}
                    {user.stuckTasks > 0 && (
                        <span className="text-amber-500">{user.stuckTasks} stuck</span>
                    )}
                    {user.helpRequestTasks > 0 && (
                        <span className="text-amber-500">{user.helpRequestTasks} need help</span>
                    )}
                    <span className="text-green-600">{user.doneTasks} done</span>
                </div>

                {/* Mini Kanban Grid */}
                <div className="flex-1 overflow-auto py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <MiniKanbanColumn
                            name="To Do"
                            tasks={todoTasks}
                            onTaskClick={handleTaskClick}
                            maxVisible={4}
                        />
                        <MiniKanbanColumn
                            name="In Progress"
                            tasks={inProgressTasks}
                            onTaskClick={handleTaskClick}
                            maxVisible={4}
                        />
                        <MiniKanbanColumn
                            name="Review"
                            tasks={reviewTasks}
                            onTaskClick={handleTaskClick}
                            maxVisible={4}
                        />
                        <MiniKanbanColumn
                            name="Done"
                            tasks={doneTasks}
                            onTaskClick={handleTaskClick}
                            maxVisible={2}
                        />
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    )
}

function AssignTasksDialog({
    open,
    onOpenChange,
    user,
    unassignedTasks,
    onAssign
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: UserStat | null
    unassignedTasks: Task[]
    onAssign: (taskIds: string[], userId: string) => Promise<void>
}) {
    const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
    const [isAssigning, setIsAssigning] = useState(false)

    const toggleTask = (taskId: string) => {
        setSelectedTasks(prev => {
            const next = new Set(prev)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })
    }

    const handleAssign = async () => {
        if (!user || selectedTasks.size === 0) return
        setIsAssigning(true)
        await onAssign(Array.from(selectedTasks), user.id)
        setIsAssigning(false)
        setSelectedTasks(new Set())
        onOpenChange(false)
    }

    if (!user) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sm flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Assign Tasks to {user.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    <p className="text-xs text-muted-foreground mb-3">
                        Select unassigned tasks to assign to {user.name.split(' ')[0]}.
                        Current workload: {user.activeTasks} active tasks.
                    </p>

                    <div className="flex-1 overflow-y-auto max-h-[40vh] space-y-1 border rounded-md p-2">
                        {unassignedTasks.length > 0 ? (
                            unassignedTasks.map(task => (
                                <div
                                    key={task.id}
                                    onClick={() => toggleTask(task.id)}
                                    className={cn(
                                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                                        selectedTasks.has(task.id)
                                            ? "bg-primary/10 border border-primary/30"
                                            : "hover:bg-muted/50"
                                    )}
                                >
                                    <Checkbox checked={selectedTasks.has(task.id)} />
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: task.projectColor }}
                                        />
                                        <span className="text-xs truncate">{task.title}</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground shrink-0">
                                        {task.projectName}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-muted-foreground text-center py-8">
                                No unassigned tasks available
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleAssign}
                        disabled={selectedTasks.size === 0 || isAssigning}
                    >
                        {isAssigning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Assign {selectedTasks.size > 0 ? `(${selectedTasks.size})` : ''}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function DashboardHeatmap({
    userStats,
    criticalIssues,
    overloadedUsers,
    idleUsers,
    allTasks
}: DashboardHeatmapProps) {
    const router = useRouter()
    const [selectedIssue, setSelectedIssue] = useState<CriticalIssue | null>(null)
    const [selectedUser, setSelectedUser] = useState<UserStat | null>(null)
    const [assigningToUser, setAssigningToUser] = useState<UserStat | null>(null)
    const [showAllMembers, setShowAllMembers] = useState(false)

    const maxWorkload = Math.max(...userStats.map(u => u.workloadScore), 1)
    const totalActiveTasks = allTasks.filter(t => t.columnName !== 'Done').length

    // Sort users by workload
    const sortedUsers = [...userStats].sort((a, b) => b.workloadScore - a.workloadScore)
    const displayedUsers = showAllMembers ? sortedUsers : sortedUsers.slice(0, 8)

    const unassignedTasks = allTasks.filter(t => t.isUnassigned)

    const handleAssignTasks = async (taskIds: string[], userId: string) => {
        const errors: string[] = []
        for (const taskId of taskIds) {
            try {
                const res = await fetch(`/api/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assigneeIds: [userId] })
                })
                if (!res.ok) {
                    errors.push(taskId)
                }
            } catch (error) {
                errors.push(taskId)
            }
        }
        if (errors.length > 0) {
            console.error(`Failed to assign ${errors.length} task(s)`)
        }
        router.refresh()
    }

    if (criticalIssues.length === 0 && userStats.length === 0) {
        return null
    }

    return (
        <section className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-medium">
                        Work Distribution
                    </h2>
                    {criticalIssues.filter(i => i.type === 'overdue').map((issue, idx) => (
                        <button
                            key={`overdue-${idx}`}
                            onClick={() => issue.tasks.length > 0 && setSelectedIssue(issue)}
                            className="text-[10px] text-red-600 underline hover:text-red-700"
                        >
                            {issue.count} overdue
                        </button>
                    ))}
                    {criticalIssues.filter(i => i.type === 'stuck').map((issue, idx) => (
                        <button
                            key={`stuck-${idx}`}
                            onClick={() => issue.tasks.length > 0 && setSelectedIssue(issue)}
                            className="text-[10px] text-amber-600 underline hover:text-amber-700"
                        >
                            {issue.count} stuck
                        </button>
                    ))}
                </div>
                <span className="text-[10px] text-muted-foreground">
                    {totalActiveTasks} active tasks
                </span>
            </div>

            {/* Workload Distribution Grid */}
            <div className="mb-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {displayedUsers.map(user => {
                        const isOverloaded = overloadedUsers.includes(user.id)
                        const isIdle = idleUsers.includes(user.id)

                        return (
                            <div
                                key={user.id}
                                className={cn(
                                    "p-2 rounded-md border transition-all text-left relative group",
                                    getWorkloadColor(user.workloadScore, maxWorkload),
                                    isOverloaded && "ring-2 ring-red-400",
                                    isIdle && "ring-2 ring-blue-400"
                                )}
                            >
                                {/* User header - clickable for view tasks */}
                                <button
                                    onClick={() => setSelectedUser(user)}
                                    className="w-full text-left"
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <div className="w-5 h-5 rounded-full bg-background flex items-center justify-center text-[9px] font-medium shrink-0 border">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <p className="text-[10px] font-medium truncate">{user.name.split(' ')[0]}</p>
                                        </div>
                                        <span className="text-[9px] text-muted-foreground shrink-0">
                                            {user.activeTasks} active
                                        </span>
                                    </div>

                                    {/* Issue badges - only show if any */}
                                    {(user.overdueTasks > 0 || user.stuckTasks > 0 || user.helpRequestTasks > 0 || isIdle) && (
                                        <div className="flex items-center gap-1 flex-wrap mt-1.5">
                                            {user.overdueTasks > 0 && (
                                                <span className="text-[8px] px-1 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/50">
                                                    {user.overdueTasks} late
                                                </span>
                                            )}
                                            {user.stuckTasks > 0 && (
                                                <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/50">
                                                    {user.stuckTasks} stuck
                                                </span>
                                            )}
                                            {user.helpRequestTasks > 0 && (
                                                <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/50">
                                                    {user.helpRequestTasks} help
                                                </span>
                                            )}
                                            {isIdle && (
                                                <span className="text-[8px] px-1 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/50">
                                                    Free
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>

                                {/* Assign button - appears on hover */}
                                {unassignedTasks.length > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setAssigningToUser(user)
                                        }}
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                                        title="Assign tasks"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* More members button */}
                {sortedUsers.length > 8 && (
                    <button
                        onClick={() => setShowAllMembers(!showAllMembers)}
                        className="w-full mt-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                    >
                        {showAllMembers ? 'Show less' : `+${sortedUsers.length - 8} more members`}
                    </button>
                )}
            </div>

            {/* Unassigned Tasks Quick View */}
            {unassignedTasks.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                    <h4 className="text-[10px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <UserX className="h-3 w-3" />
                        Unassigned Tasks ({unassignedTasks.length})
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {unassignedTasks.slice(0, 5).map(task => (
                            <Link
                                key={task.id}
                                href={`/dashboard/projects/${task.projectId}?task=${task.id}`}
                                className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: task.projectColor }}
                                    />
                                    <span className="text-[10px] truncate">{task.title}</span>
                                </div>
                                <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                            </Link>
                        ))}
                        {unassignedTasks.length > 5 && (
                            <p className="text-[9px] text-muted-foreground text-center">
                                +{unassignedTasks.length - 5} more
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Task List Dialog for Issues */}
            <TaskListDialog
                open={!!selectedIssue}
                onOpenChange={() => setSelectedIssue(null)}
                title={selectedIssue?.message || ''}
                tasks={selectedIssue?.tasks || []}
            />

            {/* User Kanban Dialog */}
            <UserKanbanDialog
                open={!!selectedUser}
                onOpenChange={() => setSelectedUser(null)}
                user={selectedUser}
                unassignedTasks={unassignedTasks}
                onAssignClick={() => {
                    setAssigningToUser(selectedUser)
                }}
            />

            {/* Assign Tasks Dialog */}
            <AssignTasksDialog
                open={!!assigningToUser}
                onOpenChange={() => setAssigningToUser(null)}
                user={assigningToUser}
                unassignedTasks={unassignedTasks}
                onAssign={handleAssignTasks}
            />
        </section>
    )
}
