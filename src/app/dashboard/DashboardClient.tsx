"use client"

import { useState } from "react"
import { Clock, ArrowRight, User } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Activity = {
    id: string
    action: string
    field: string | null
    oldValue: string | null
    newValue: string | null
    taskTitle: string | null
    changedByName: string
    createdAt: Date | string
    task: {
        id: string
        column: {
            board: {
                project: { id: string }
            }
        } | null
    } | null
}

function formatTimeAgo(date: Date | string): string {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

function formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    })
}

function getActionDescription(action: string, field: string | null): string {
    if (action === 'created') return 'Created this task'
    if (action === 'moved') return 'Moved this task'
    if (action === 'updated') {
        if (field === 'title') return 'Updated the title'
        if (field === 'description') return 'Updated the description'
        if (field === 'assignee') return 'Changed the assignee'
        if (field === 'progress') return 'Updated progress'
        if (field === 'status') return 'Changed status'
        return `Updated ${field || 'details'}`
    }
    if (action === 'deleted') return 'Deleted'
    if (action === 'commented') return 'Added a comment'
    if (action === 'attachment') return 'Added an attachment'
    return action
}

export function DashboardClient({ activity }: { activity: Activity }) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors text-xs text-left"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">{activity.changedByName.split(' ')[0]}</span>
                    <span className="truncate">{activity.taskTitle || 'Task'}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeAgo(activity.createdAt).replace(' ago', '').replace('just now', 'now').replace(' minutes', 'm').replace(' minute', 'm').replace(' hours', 'h').replace(' hour', 'h').replace(' days', 'd').replace(' day', 'd')}</span>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold leading-snug pr-6">
                            Activity Details
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                        {/* Task Name */}
                        <div>
                            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Task</div>
                            <div className="text-sm font-medium">{activity.taskTitle || 'Unknown Task'}</div>
                        </div>

                        {/* Changed By */}
                        <div>
                            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Changed By</div>
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="text-sm">{activity.changedByName}</span>
                            </div>
                        </div>

                        {/* Action */}
                        <div>
                            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Action</div>
                            <div className="text-sm">{getActionDescription(activity.action, activity.field)}</div>
                        </div>

                        {/* Field Changed */}
                        {activity.field && (
                            <div>
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Field</div>
                                <div className="text-sm capitalize">{activity.field.replace(/([A-Z])/g, ' $1').trim()}</div>
                            </div>
                        )}

                        {/* Value Change */}
                        {(activity.oldValue || activity.newValue) && (
                            <div>
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Change</div>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                                    {activity.oldValue ? (
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] text-muted-foreground mb-0.5">From</div>
                                            <div className="text-sm truncate text-red-600/80 line-through">{activity.oldValue}</div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] text-muted-foreground mb-0.5">From</div>
                                            <div className="text-sm text-muted-foreground italic">None</div>
                                        </div>
                                    )}
                                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                    {activity.newValue ? (
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] text-muted-foreground mb-0.5">To</div>
                                            <div className="text-sm truncate text-emerald-600 font-medium">{activity.newValue}</div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] text-muted-foreground mb-0.5">To</div>
                                            <div className="text-sm text-muted-foreground italic">None</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Timestamp */}
                        <div>
                            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">When</div>
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{formatDate(activity.createdAt)}</span>
                                <span className="text-muted-foreground">({formatTimeAgo(activity.createdAt)})</span>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
