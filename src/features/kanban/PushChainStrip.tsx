"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, Pencil, Plus, Lock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

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

const COLLAPSED_SIZE = 48
const BAR_HEIGHT = 48

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

    // Check if a push is locked (its dependency is not complete)
    const isLocked = useCallback((push: PushType) => {
        if (!push.dependsOnId) return false
        return !isComplete(push.dependsOnId)
    }, [isComplete])

    // Track which push is currently expanded
    const [expandedPushId, setExpandedPushId] = useState<string | null>(activePushId)
    // Track if content panel is open
    const [isContentOpen, setIsContentOpen] = useState(true)
    // Track which square is being hovered
    const [hoveredId, setHoveredId] = useState<string | null>(null)

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

    const handlePushClick = useCallback((push: PushType) => {
        // If locked, don't allow interaction
        if (isLocked(push)) return

        if (push.id === expandedPushId) {
            // Toggle content open/close
            setIsContentOpen(prev => !prev)
        } else {
            // Switch to different push
            setExpandedPushId(push.id)
            setIsContentOpen(true)
        }
    }, [expandedPushId, isLocked])

    const expandedPush = chain.find(p => p.id === expandedPushId)

    if (!expandedPush || chain.length < 2) return null

    return (
        <div className="w-full">
            {/* Chain Strip Header */}
            <div
                className="flex items-center gap-2 p-2"
                style={{ height: BAR_HEIGHT + 16 }}
            >
                {chain.map((push, index) => {
                    const isExpanded = push.id === expandedPushId
                    const pushIsComplete = isComplete(push.id)
                    const pushIsLocked = isLocked(push)
                    const isHovered = hoveredId === push.id

                    if (isExpanded) {
                        // Expanded push - takes remaining space
                        return (
                            <motion.div
                                key={push.id}
                                layout
                                initial={false}
                                animate={{ flex: 1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30
                                }}
                                className="relative min-w-0 rounded-xl overflow-hidden cursor-pointer"
                                style={{
                                    height: BAR_HEIGHT,
                                    background: `linear-gradient(135deg, ${push.color}dd, ${push.color}99)`,
                                }}
                                onClick={() => handlePushClick(push)}
                            >
                                <div className="h-full flex items-center gap-3 px-4">
                                    {/* Completion badge */}
                                    {pushIsComplete && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="bg-white/25 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-bold text-white tracking-wide shrink-0"
                                        >
                                            DONE
                                        </motion.span>
                                    )}

                                    {/* Push name */}
                                    <span className="text-sm font-semibold text-white truncate">
                                        {push.name}
                                    </span>

                                    {/* Progress & controls */}
                                    <div className="ml-auto flex items-center gap-3 shrink-0">
                                        {!pushIsComplete && push.taskCount > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-14 h-1.5 bg-white/30 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-white rounded-full"
                                                        initial={false}
                                                        animate={{ width: `${(push.completedCount / push.taskCount) * 100}%` }}
                                                        transition={{ duration: 0.5 }}
                                                    />
                                                </div>
                                                <span className="text-[11px] text-white/80 font-medium tabular-nums">
                                                    {push.completedCount}/{push.taskCount}
                                                </span>
                                            </div>
                                        )}

                                        <span className="text-[11px] text-white/50 font-medium">
                                            {index + 1}/{chain.length}
                                        </span>

                                        {isAdmin && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onAddTask(push)
                                                    }}
                                                    className="h-7 flex items-center gap-1 px-2 rounded-md bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-medium"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Task</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => onEditPush(e, push)}
                                                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors text-white/80"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        )}

                                        <motion.div
                                            animate={{ rotate: isContentOpen ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronDown className="h-4 w-4 text-white/60" />
                                        </motion.div>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    }

                    // Collapsed push - grows on hover to show name
                    const isUpcoming = !pushIsComplete && push.id !== activePushId

                    return (
                        <motion.button
                            key={push.id}
                            type="button"
                            layout
                            initial={false}
                            animate={{
                                width: isHovered && !pushIsLocked ? 'auto' : COLLAPSED_SIZE,
                                minWidth: isHovered && !pushIsLocked ? 120 : COLLAPSED_SIZE,
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 35
                            }}
                            onClick={() => handlePushClick(push)}
                            onMouseEnter={() => setHoveredId(push.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            disabled={pushIsLocked}
                            className={cn(
                                "relative flex items-center justify-center rounded-xl overflow-hidden",
                                pushIsLocked
                                    ? "cursor-not-allowed opacity-50"
                                    : "cursor-pointer hover:shadow-lg"
                            )}
                            style={{
                                height: BAR_HEIGHT,
                                background: pushIsComplete
                                    ? `linear-gradient(135deg, ${push.color}cc, ${push.color}99)`
                                    : isUpcoming || pushIsLocked
                                        ? `repeating-linear-gradient(
                                            -45deg,
                                            ${push.color}35,
                                            ${push.color}35 4px,
                                            ${push.color}18 4px,
                                            ${push.color}18 8px
                                          )`
                                        : `linear-gradient(135deg, ${push.color}99, ${push.color}66)`,
                            }}
                        >
                            <AnimatePresence mode="wait">
                                {isHovered && !pushIsLocked ? (
                                    <motion.div
                                        key="expanded"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex items-center gap-2 px-3"
                                    >
                                        {pushIsComplete && (
                                            <Check className="h-4 w-4 text-white shrink-0" strokeWidth={3} />
                                        )}
                                        <span className="text-xs font-semibold text-white truncate">
                                            {push.name}
                                        </span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="collapsed"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex items-center justify-center"
                                    >
                                        {pushIsLocked ? (
                                            <Lock className="h-4 w-4 text-white/50" />
                                        ) : pushIsComplete ? (
                                            <Check className="h-5 w-5 text-white" strokeWidth={3} />
                                        ) : (
                                            <span className="text-sm font-bold text-white/60">
                                                {index + 1}
                                            </span>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    )
                })}
            </div>

            {/* Content Panel */}
            <AnimatePresence initial={false}>
                {isContentOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            height: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-2">
                            {loadingPushes[expandedPush.id] ? (
                                <div className="h-[200px] rounded-xl bg-muted/30 animate-pulse" />
                            ) : (
                                renderPushBoard(expandedPush.id)
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
