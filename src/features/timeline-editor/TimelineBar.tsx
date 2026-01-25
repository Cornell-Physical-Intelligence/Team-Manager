"use client"

import { useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { GripVertical, Lock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { type PushDraft, type DragType, formatDateShort, differenceInDays, addDays, startOfDay } from "./types"

type TimelineBarProps = {
    push: PushDraft
    timelineStart: Date
    timelineEnd: Date
    onUpdate: (id: string, updates: Partial<PushDraft>) => void
    onDelete: (id: string) => void
    isSelected: boolean
    onSelect: (id: string | null) => void
    onClick?: () => void
    rowIndex: number
    readOnly?: boolean
    isConnecting?: boolean
    isDependent?: boolean
    dependencyCompleted?: boolean
}

const ROW_HEIGHT = 48

export function TimelineBar({
    push,
    timelineStart,
    timelineEnd,
    onUpdate,
    onDelete,
    isSelected,
    onSelect,
    onClick,
    rowIndex,
    readOnly = false,
    isConnecting = false,
    isDependent = false,
    dependencyCompleted = true
}: TimelineBarProps) {
    const barRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [dragType, setDragType] = useState<DragType>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0 })

    const totalDuration = timelineEnd.getTime() - timelineStart.getTime()

    const getPositionPercent = useCallback((date: Date) => {
        return ((date.getTime() - timelineStart.getTime()) / totalDuration) * 100
    }, [timelineStart, totalDuration])

    const pushEnd = push.endDate || addDays(push.startDate, 14)
    const leftPercent = getPositionPercent(push.startDate)
    const widthPercent = getPositionPercent(pushEnd) - leftPercent

    // Drag handlers
    const handlePointerDown = useCallback((e: React.PointerEvent, type: DragType) => {
        if (readOnly) return
        e.preventDefault()
        e.stopPropagation()

        const target = e.currentTarget as HTMLElement
        target.setPointerCapture(e.pointerId)

        setIsDragging(true)
        setDragType(type)
        setDragOffset({ x: 0 })
        onSelect(push.tempId)
    }, [readOnly, push.tempId, onSelect])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging || !barRef.current) return

        const container = barRef.current.parentElement
        if (!container) return

        const rect = container.getBoundingClientRect()
        const percentPerPixel = 100 / rect.width
        const deltaPercent = e.movementX * percentPerPixel

        setDragOffset(prev => ({ x: prev.x + deltaPercent }))
    }, [isDragging])

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return

        const target = e.currentTarget as HTMLElement
        target.releasePointerCapture(e.pointerId)

        // Calculate final dates based on drag offset
        const daysDelta = Math.round((dragOffset.x / 100) * (totalDuration / (1000 * 60 * 60 * 24)))

        if (daysDelta !== 0) {
            if (dragType === 'move') {
                const newStart = addDays(push.startDate, daysDelta)
                const newEnd = push.endDate ? addDays(push.endDate, daysDelta) : null
                onUpdate(push.tempId, { startDate: newStart, endDate: newEnd })
            } else if (dragType === 'resize-start') {
                const newStart = addDays(push.startDate, daysDelta)
                if (newStart < pushEnd) {
                    onUpdate(push.tempId, { startDate: newStart })
                }
            } else if (dragType === 'resize-end') {
                const currentEnd = push.endDate || addDays(push.startDate, 14)
                const newEnd = addDays(currentEnd, daysDelta)
                if (newEnd > push.startDate) {
                    onUpdate(push.tempId, { endDate: newEnd })
                }
            }
        }

        setIsDragging(false)
        setDragType(null)
        setDragOffset({ x: 0 })
    }, [isDragging, dragOffset, dragType, push, pushEnd, totalDuration, onUpdate])

    // Handle click (not drag) to open edit popup
    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!isDragging && onClick) {
            e.stopPropagation()
            onClick()
        }
    }, [isDragging, onClick])

    // Calculate visual position during drag
    let visualLeft = leftPercent
    let visualWidth = widthPercent

    if (isDragging && dragOffset.x !== 0) {
        if (dragType === 'move') {
            visualLeft = leftPercent + dragOffset.x
        } else if (dragType === 'resize-start') {
            visualLeft = leftPercent + dragOffset.x
            visualWidth = widthPercent - dragOffset.x
        } else if (dragType === 'resize-end') {
            visualWidth = widthPercent + dragOffset.x
        }
    }

    const duration = differenceInDays(pushEnd, push.startDate)

    // Determine if push is greyed out (dependent and dependency not completed)
    const isGreyedOut = isDependent && !dependencyCompleted

    return (
        <div
            ref={barRef}
            data-timeline-bar
            className={cn(
                "absolute h-9 rounded-lg cursor-pointer transition-all select-none",
                isDragging && "z-50 shadow-lg scale-[1.02]",
                isSelected && !isDragging && "ring-2 ring-primary ring-offset-1",
                !isDragging && "hover:brightness-110",
                isConnecting && "ring-2 ring-primary/50 animate-pulse",
                isGreyedOut && "opacity-50"
            )}
            style={{
                left: `${visualLeft}%`,
                width: `${Math.max(visualWidth, 2)}%`,
                top: `${rowIndex * ROW_HEIGHT + 6}px`,
                background: isGreyedOut
                    ? `linear-gradient(90deg, #94a3b8dd, #94a3b8bb)`
                    : `linear-gradient(90deg, ${push.color}ee, ${push.color}bb)`,
                transform: isDragging ? 'scale(1.02)' : undefined,
                transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)'
            }}
            onClick={handleClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Left resize handle */}
            {!readOnly && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-l-lg transition-colors"
                    onPointerDown={(e) => handlePointerDown(e, 'resize-start')}
                />
            )}

            {/* Main bar content - draggable */}
            <div
                className={cn(
                    "absolute inset-0 mx-2 flex items-center gap-1 overflow-hidden",
                    !readOnly && "cursor-grab active:cursor-grabbing"
                )}
                onPointerDown={(e) => !readOnly && handlePointerDown(e, 'move')}
            >
                {!readOnly && (
                    <GripVertical className="h-3 w-3 text-white/60 shrink-0" />
                )}

                {isGreyedOut && (
                    <Lock className="h-3 w-3 text-white/60 shrink-0" />
                )}

                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="text-xs font-medium text-white truncate">
                            {push.name || 'Untitled Push'}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                        <div className="font-medium">{push.name || 'Untitled Push'}</div>
                        <div className="text-muted-foreground">
                            {formatDateShort(push.startDate)} - {formatDateShort(pushEnd)}
                        </div>
                        <div className="text-muted-foreground">{duration} days</div>
                        {isDependent && !dependencyCompleted && (
                            <div className="text-amber-500 mt-1">Waiting for dependency</div>
                        )}
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Right resize handle */}
            {!readOnly && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r-lg transition-colors"
                    onPointerDown={(e) => handlePointerDown(e, 'resize-end')}
                />
            )}

            {/* Dependency indicator dot */}
            {isDependent && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-muted-foreground/70 border border-white" />
            )}
        </div>
    )
}
