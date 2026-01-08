"use client"

import { useState } from "react"
import { Clock } from "lucide-react"
import { TaskPreview } from "@/features/kanban/TaskPreview"

type MyTaskCardProps = {
    task: {
        id: string
        title: string
        description: string | null
        startDate: Date | string | null
        endDate: Date | string | null
        dueDate: Date | string | null
        assignee: { id: string; name: string } | null
        column: {
            name: string
            board: {
                project: {
                    id: string
                    name: string
                    color?: string | null
                }
            }
        } | null
        createdAt: Date | string | null
        updatedAt: Date | string | null
    }
}

function getTimeUntilDue(dueDate: Date | string | null): { text: string; isOverdue: boolean; isUrgent: boolean } {
    if (!dueDate) return { text: '', isOverdue: false, isUrgent: false }

    const now = new Date()
    const due = new Date(dueDate)
    const diffMs = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

    if (diffMs < 0) {
        const overdueDays = Math.abs(diffDays)
        if (overdueDays === 0) return { text: 'Due today', isOverdue: true, isUrgent: true }
        if (overdueDays === 1) return { text: '1d overdue', isOverdue: true, isUrgent: true }
        return { text: `${overdueDays}d overdue`, isOverdue: true, isUrgent: true }
    }

    if (diffHours <= 24) {
        if (diffHours <= 1) return { text: '<1h left', isOverdue: false, isUrgent: true }
        return { text: `${diffHours}h left`, isOverdue: false, isUrgent: true }
    }

    if (diffDays === 1) return { text: 'Tomorrow', isOverdue: false, isUrgent: true }
    if (diffDays <= 7) return { text: `${diffDays}d left`, isOverdue: false, isUrgent: diffDays <= 3 }

    return { text: `${diffDays}d left`, isOverdue: false, isUrgent: false }
}

export function MyTaskCard({ task }: MyTaskCardProps) {
    const [showTaskPreview, setShowTaskPreview] = useState(false)

    const project = task.column?.board?.project
    const projectColor = project?.color || '#6b7280'
    const { text: dueText, isOverdue, isUrgent } = task.column?.name !== 'Done'
        ? getTimeUntilDue(task.dueDate)
        : { text: '', isOverdue: false, isUrgent: false }

    return (
        <>
            <div
                onClick={() => setShowTaskPreview(true)}
                className="group cursor-pointer rounded-lg p-3 transition-all border border-border bg-card hover:bg-accent/50"
            >
                {/* Row 1: Title + Due Date */}
                <div className="flex justify-between items-start gap-4">
                    {/* Left: Title */}
                    <h4 className="flex-1 text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {task.title}
                    </h4>

                    {/* Right: Due Date */}
                    {dueText && (
                        <div className={`
                            text-xs font-medium flex items-center gap-1 shrink-0
                            ${isOverdue ? 'text-red-500' : ''}
                            ${isUrgent && !isOverdue ? 'text-amber-500' : ''}
                            ${!isUrgent && !isOverdue ? 'text-muted-foreground' : ''}
                        `}>
                            <Clock className="h-3 w-3" />
                            <span>{dueText}</span>
                        </div>
                    )}
                </div>

                {/* Row 2: Description (if exists) */}
                {task.description && (
                    <p className="text-xs text-muted-foreground/60 truncate mt-1.5">
                        {task.description}
                    </p>
                )}

                {/* Row 3: Project Badge */}
                {project && (
                    <div className="mt-2">
                        <span
                            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                                backgroundColor: `${projectColor}20`,
                                color: projectColor
                            }}
                        >
                            {project.name}
                        </span>
                    </div>
                )}
            </div>

            {showTaskPreview && (
                <TaskPreview
                    task={{
                        id: task.id,
                        title: task.title,
                        description: task.description,
                        startDate: task.startDate,
                        endDate: task.endDate,
                        dueDate: task.dueDate,
                        assignee: task.assignee,
                        column: task.column,
                        columnId: null,
                        createdAt: task.createdAt || undefined,
                        updatedAt: task.updatedAt || undefined
                    }}
                    open={showTaskPreview}
                    onOpenChange={(open) => {
                        setShowTaskPreview(open)
                    }}
                    onEdit={() => { }}
                    projectId={task.column?.board?.project?.id || ''}
                />
            )}
        </>
    )
}
