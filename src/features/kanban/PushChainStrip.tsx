"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

type PushType = {
    id: string
    name: string
    startDate: Date | string
    endDate: Date | string | null
    status: string
    color: string
    taskCount: number
    completedCount: number
    dependsOnId?: string | null
}

type PushChainStripProps = {
    chain: PushType[]
    isComplete: (pushId: string) => boolean
    onPushClick: (push: PushType) => void
    onExpandChange?: (pushId: string, expanded: boolean) => void
}

const SQUARE_SIZE = 36

export function PushChainStrip({
    chain,
    isComplete,
    onPushClick,
    onExpandChange
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

    // Track which push is currently expanded (defaults to active)
    const [expandedPushId, setExpandedPushId] = useState<string | null>(activePushId)

    // Sync expandedPushId when activePushId changes (e.g., push completed)
    useEffect(() => {
        setExpandedPushId(activePushId)
    }, [activePushId])

    const handleSquareClick = (e: React.MouseEvent, pushId: string) => {
        e.stopPropagation()
        setExpandedPushId(pushId)
        onExpandChange?.(pushId, true)
    }

    const handleExpandedClick = (push: PushType) => {
        onPushClick(push)
    }

    const expandedPush = chain.find(p => p.id === expandedPushId)

    if (!expandedPush || chain.length < 2) return null

    return (
        <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-1.5 h-10 px-2">
            {chain.map((push, index) => {
                const isExpanded = push.id === expandedPushId
                const pushIsComplete = isComplete(push.id)

                if (isExpanded) {
                    // Render expanded push
                    return (
                        <button
                            key={push.id}
                            type="button"
                            onClick={() => handleExpandedClick(push)}
                            className={cn(
                                "relative flex-1 h-full rounded-lg cursor-pointer min-w-0",
                                "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                                "hover:brightness-110 hover:scale-[1.01]",
                                "flex items-center gap-2 px-3",
                                pushIsComplete && "opacity-80"
                            )}
                            style={{
                                background: `linear-gradient(90deg, ${push.color}ee, ${push.color}bb)`
                            }}
                        >
                            {pushIsComplete && (
                                <span className="bg-white/25 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shrink-0">
                                    DONE
                                </span>
                            )}

                            <span className="text-sm font-semibold text-white truncate">
                                {push.name}
                            </span>

                            <div className="ml-auto flex items-center gap-2 text-white/70 text-xs shrink-0">
                                <span>{push.completedCount}/{push.taskCount}</span>
                                <span className="text-white/50">•</span>
                                <span>{index + 1}/{chain.length}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                            </div>
                        </button>
                    )
                }

                // Render collapsed square
                return (
                    <Tooltip key={push.id}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={(e) => handleSquareClick(e, push.id)}
                                className={cn(
                                    "relative flex items-center justify-center shrink-0 rounded-md cursor-pointer",
                                    "transition-all duration-200 ease-out",
                                    "hover:scale-110 hover:brightness-110",
                                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                                )}
                                style={{
                                    width: SQUARE_SIZE,
                                    height: SQUARE_SIZE,
                                    background: pushIsComplete
                                        ? `${push.color}cc`
                                        : `repeating-linear-gradient(
                                            45deg,
                                            ${push.color}55,
                                            ${push.color}55 3px,
                                            ${push.color}22 3px,
                                            ${push.color}22 6px
                                          )`,
                                    opacity: pushIsComplete ? 1 : 0.75
                                }}
                            >
                                {pushIsComplete && (
                                    <Check
                                        className="h-4 w-4 text-white animate-checkmark-appear"
                                        strokeWidth={3}
                                    />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{push.name}</div>
                            <div className="text-muted-foreground">
                                {pushIsComplete ? 'Completed' : 'Upcoming'} • {push.completedCount}/{push.taskCount} tasks
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )
            })}
            </div>
        </TooltipProvider>
    )
}
