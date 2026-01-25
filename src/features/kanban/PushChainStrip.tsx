"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, Pencil, Plus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

type PushType = {
    id: string
    name: string
    startDate: Date | string
    endDate: Date | string | null
    status: string
    color: string
    projectId: string
    taskCount: number
    completedCount: number
    dependsOnId?: string | null
}

type PushChainStripProps = {
    chain: PushType[]
    isComplete: (pushId: string) => boolean
    isAdmin: boolean
    onEditPush: (e: React.MouseEvent, push: PushType) => void
    onAddTask: (push: PushType) => void
    loadPushTasks: (pushId: string) => void
    loadedPushes: Record<string, true>
    loadingPushes: Record<string, true>
    renderPushBoard: (pushId: string) => React.ReactNode
}

const COLLAPSED_SIZE = 44
const ANIMATION_DURATION = 350

export function PushChainStrip({
    chain,
    isComplete,
    isAdmin,
    onEditPush,
    onAddTask,
    loadPushTasks,
    loadedPushes,
    loadingPushes,
    renderPushBoard
}: PushChainStripProps) {
    // Determine the active push (first incomplete in chain)
    const activePushId = useMemo(() => {
        for (const push of chain) {
            if (!isComplete(push.id)) {
                return push.id
            }
        }
        // All completed - return the last one
        return chain[chain.length - 1]?.id ?? null
    }, [chain, isComplete])

    // Track which push is currently expanded
    const [expandedPushId, setExpandedPushId] = useState<string | null>(activePushId)
    // Track if content panel is open
    const [isContentOpen, setIsContentOpen] = useState(true)
    // Track animation state
    const [isAnimating, setIsAnimating] = useState(false)

    // Sync expandedPushId when activePushId changes
    useEffect(() => {
        if (!expandedPushId || !chain.find(p => p.id === expandedPushId)) {
            setExpandedPushId(activePushId)
        }
    }, [activePushId, expandedPushId, chain])

    // Load tasks when expanded push changes
    useEffect(() => {
        if (expandedPushId && !loadedPushes[expandedPushId]) {
            loadPushTasks(expandedPushId)
        }
    }, [expandedPushId, loadedPushes, loadPushTasks])

    const handlePushClick = useCallback((pushId: string) => {
        if (pushId === expandedPushId) {
            // Toggle content open/close
            setIsContentOpen(prev => !prev)
        } else {
            // Switch to different push with animation
            setIsAnimating(true)
            setExpandedPushId(pushId)
            setIsContentOpen(true)
            setTimeout(() => setIsAnimating(false), ANIMATION_DURATION)
        }
    }, [expandedPushId])

    const expandedPush = chain.find(p => p.id === expandedPushId)

    if (!expandedPush || chain.length < 2) return null

    return (
        <TooltipProvider delayDuration={200}>
            <div className="w-full">
                {/* Chain Strip Header */}
                <div className="flex items-stretch gap-2 p-2">
                    {chain.map((push) => {
                        const isExpanded = push.id === expandedPushId
                        const pushIsComplete = isComplete(push.id)
                        const isUpcoming = !pushIsComplete && push.id !== activePushId

                        if (isExpanded) {
                            // Expanded push - takes remaining space
                            return (
                                <div
                                    key={push.id}
                                    className={cn(
                                        "relative flex-1 min-w-0 rounded-xl overflow-hidden",
                                        "transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                                        isAnimating ? "duration-350" : "duration-200"
                                    )}
                                    style={{
                                        background: `linear-gradient(135deg, ${push.color}dd, ${push.color}99)`,
                                        boxShadow: `0 4px 20px ${push.color}40`
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handlePushClick(push.id)}
                                        className="w-full flex items-center gap-3 p-3 hover:brightness-105 transition-all"
                                    >
                                        {/* Completion badge */}
                                        {pushIsComplete && (
                                            <span className="bg-white/25 backdrop-blur-sm px-2 py-1 rounded-lg text-[11px] font-bold text-white tracking-wide shrink-0">
                                                DONE
                                            </span>
                                        )}

                                        {/* Push name */}
                                        <span className="text-base font-semibold text-white truncate">
                                            {push.name}
                                        </span>

                                        {/* Progress & position */}
                                        <div className="ml-auto flex items-center gap-3 shrink-0">
                                            {!pushIsComplete && push.taskCount > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-white rounded-full transition-all duration-500"
                                                            style={{ width: `${(push.completedCount / push.taskCount) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-white/80 font-medium">
                                                        {push.completedCount}/{push.taskCount}
                                                    </span>
                                                </div>
                                            )}

                                            <span className="text-xs text-white/60 font-medium">
                                                {chain.indexOf(push) + 1}/{chain.length}
                                            </span>

                                            {isAdmin && (
                                                <>
                                                    <div
                                                        role="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onAddTask(push)
                                                        }}
                                                        className="h-7 flex items-center gap-1 px-2 rounded-md bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-medium"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        <span className="hidden sm:inline">Task</span>
                                                    </div>
                                                    <div
                                                        role="button"
                                                        onClick={(e) => onEditPush(e, push)}
                                                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors text-white/80"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </div>
                                                </>
                                            )}

                                            <ChevronDown
                                                className={cn(
                                                    "h-4 w-4 text-white/70 transition-transform duration-300",
                                                    isContentOpen && "rotate-180"
                                                )}
                                            />
                                        </div>
                                    </button>
                                </div>
                            )
                        }

                        // Collapsed push - fixed size square
                        return (
                            <Tooltip key={push.id}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => handlePushClick(push.id)}
                                        className={cn(
                                            "relative flex items-center justify-center rounded-xl",
                                            "transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                                            isAnimating ? "duration-350" : "duration-200",
                                            "hover:scale-110 hover:shadow-lg",
                                            "focus:outline-none focus:ring-2 focus:ring-white/50"
                                        )}
                                        style={{
                                            width: COLLAPSED_SIZE,
                                            height: COLLAPSED_SIZE,
                                            background: pushIsComplete
                                                ? `linear-gradient(135deg, ${push.color}cc, ${push.color}99)`
                                                : isUpcoming
                                                    ? `repeating-linear-gradient(
                                                        -45deg,
                                                        ${push.color}40,
                                                        ${push.color}40 4px,
                                                        ${push.color}20 4px,
                                                        ${push.color}20 8px
                                                      )`
                                                    : `linear-gradient(135deg, ${push.color}99, ${push.color}66)`,
                                            boxShadow: pushIsComplete
                                                ? `0 2px 8px ${push.color}50`
                                                : 'none'
                                        }}
                                    >
                                        {pushIsComplete && (
                                            <Check
                                                className="h-5 w-5 text-white animate-checkmark-appear drop-shadow-sm"
                                                strokeWidth={3}
                                            />
                                        )}
                                        {!pushIsComplete && (
                                            <span className="text-xs font-bold text-white/70">
                                                {chain.indexOf(push) + 1}
                                            </span>
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    className="text-xs font-medium"
                                    sideOffset={8}
                                >
                                    <div>{push.name}</div>
                                    <div className="text-muted-foreground">
                                        {pushIsComplete ? 'Completed' : isUpcoming ? 'Upcoming' : 'Active'} • {push.completedCount}/{push.taskCount}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>

                {/* Content Panel */}
                <div
                    className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ gridTemplateRows: isContentOpen ? "1fr" : "0fr" }}
                >
                    <div className={cn(
                        "min-h-0 overflow-hidden",
                        isContentOpen ? "opacity-100" : "opacity-0"
                    )}>
                        <div className="p-4 pt-2">
                            {loadingPushes[expandedPush.id] ? (
                                <div className="h-[200px] rounded-xl bg-muted/30 animate-pulse" />
                            ) : (
                                renderPushBoard(expandedPush.id)
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}
