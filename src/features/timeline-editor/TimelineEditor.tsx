"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Calendar, Trash2 } from "lucide-react"
import { TimelineGrid } from "./TimelineGrid"
import { TimelineBar } from "./TimelineBar"
import {
    type PushDraft,
    type TimelineViewRange,
    generateTempId,
    getNextPushColor,
    addDays,
    startOfDay,
    formatDateShort,
    formatDateISO,
    differenceInDays
} from "./types"

type TimelineEditorProps = {
    pushes: PushDraft[]
    onPushesChange: (pushes: PushDraft[]) => void
    viewRange?: TimelineViewRange
    onViewRangeChange?: (range: TimelineViewRange) => void
    readOnly?: boolean
    minHeight?: number
    showConnections?: boolean
}

const ROW_HEIGHT = 48
const MIN_ROWS = 3
const HEADER_HEIGHT = 48
const MIN_DRAG_DISTANCE = 20

export function TimelineEditor({
    pushes,
    onPushesChange,
    viewRange: externalViewRange,
    onViewRangeChange,
    readOnly = false,
    minHeight = 200,
    showConnections = true
}: TimelineEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [selectedPushId, setSelectedPushId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [createStart, setCreateStart] = useState<{ x: number; date: Date } | null>(null)
    const [createPreview, setCreatePreview] = useState<{ start: Date; end: Date } | null>(null)
    const [hasDragged, setHasDragged] = useState(false)

    // Name prompt dialog state
    const [namePromptOpen, setNamePromptOpen] = useState(false)
    const [pendingPush, setPendingPush] = useState<PushDraft | null>(null)
    const [newPushName, setNewPushName] = useState("")

    // Edit popup state
    const [editingPush, setEditingPush] = useState<PushDraft | null>(null)
    const [editName, setEditName] = useState("")
    const [editStartDate, setEditStartDate] = useState("")
    const [editEndDate, setEditEndDate] = useState("")

    // Connection state - which push we're connecting FROM
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null)

    // Calculate dynamic view range based on pushes with extra space
    const calculatedViewRange = useMemo(() => {
        const today = startOfDay(new Date())

        if (pushes.length === 0) {
            return {
                start: addDays(today, -7),
                end: addDays(today, 42)
            }
        }

        const dates = pushes.flatMap(p => {
            const start = p.startDate
            const end = p.endDate || addDays(start, 14)
            return [start, end]
        })

        const minDate = new Date(Math.min(...dates.map(d => d.getTime()), today.getTime()))
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

        return {
            start: addDays(minDate, -14),
            end: addDays(maxDate, 28)
        }
    }, [pushes])

    const viewRange = externalViewRange || calculatedViewRange
    const totalDuration = viewRange.end.getTime() - viewRange.start.getTime()

    const getDateFromClientX = useCallback((clientX: number) => {
        if (!containerRef.current) return new Date()
        const rect = containerRef.current.getBoundingClientRect()
        const percent = (clientX - rect.left) / rect.width
        const timestamp = viewRange.start.getTime() + percent * totalDuration
        return startOfDay(new Date(timestamp))
    }, [viewRange, totalDuration])

    const getPositionPercent = useCallback((date: Date) => {
        return ((date.getTime() - viewRange.start.getTime()) / totalDuration) * 100
    }, [viewRange, totalDuration])

    // Handlers for creating new pushes by dragging
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (readOnly) return
        if ((e.target as HTMLElement).closest('[data-timeline-bar]')) return
        if ((e.target as HTMLElement).closest('button')) return

        // If connecting, cancel connection mode on background click
        if (connectingFrom) {
            setConnectingFrom(null)
            return
        }

        const date = getDateFromClientX(e.clientX)
        setIsCreating(true)
        setCreateStart({ x: e.clientX, date })
        setCreatePreview(null)
        setHasDragged(false)
        setSelectedPushId(null)
    }, [readOnly, getDateFromClientX, connectingFrom])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isCreating || !createStart) return

        const distanceDragged = Math.abs(e.clientX - createStart.x)

        if (distanceDragged >= MIN_DRAG_DISTANCE) {
            setHasDragged(true)
            const currentDate = getDateFromClientX(e.clientX)
            const start = currentDate < createStart.date ? currentDate : createStart.date
            const end = currentDate < createStart.date ? createStart.date : currentDate

            setCreatePreview({
                start,
                end: addDays(end, 1)
            })
        }
    }, [isCreating, createStart, getDateFromClientX])

    const handleMouseUp = useCallback(() => {
        if (!isCreating) return

        if (hasDragged && createPreview) {
            const duration = differenceInDays(createPreview.end, createPreview.start)
            if (duration >= 1) {
                const newPush: PushDraft = {
                    tempId: generateTempId(),
                    name: "",
                    startDate: createPreview.start,
                    endDate: createPreview.end,
                    color: getNextPushColor(pushes.length)
                }
                setPendingPush(newPush)
                setNewPushName(`Push ${pushes.length + 1}`)
                setNamePromptOpen(true)
            }
        }

        setIsCreating(false)
        setCreateStart(null)
        setCreatePreview(null)
        setHasDragged(false)
    }, [isCreating, hasDragged, createPreview, pushes.length])

    // Handle name prompt submission
    const handleNameSubmit = useCallback(() => {
        if (pendingPush && newPushName.trim()) {
            const pushWithName = { ...pendingPush, name: newPushName.trim() }
            onPushesChange([...pushes, pushWithName])
            setSelectedPushId(pushWithName.tempId)
        }
        setNamePromptOpen(false)
        setPendingPush(null)
        setNewPushName("")
    }, [pendingPush, newPushName, pushes, onPushesChange])

    // Handle push click to open edit popup
    const handlePushClick = useCallback((push: PushDraft) => {
        // If we're in connection mode, complete the connection
        if (connectingFrom) {
            if (connectingFrom !== push.tempId) {
                const fromPush = pushes.find(p => p.tempId === connectingFrom)
                if (fromPush) {
                    const fromEnd = fromPush.endDate || addDays(fromPush.startDate, 14)
                    // Only allow connection if this push starts after the source ends
                    if (push.startDate >= fromEnd) {
                        onPushesChange(pushes.map(p =>
                            p.tempId === push.tempId ? { ...p, dependsOn: connectingFrom } : p
                        ))
                    }
                }
            }
            setConnectingFrom(null)
            return
        }

        // Otherwise open edit dialog
        setEditingPush(push)
        setEditName(push.name)
        setEditStartDate(formatDateISO(push.startDate))
        setEditEndDate(push.endDate ? formatDateISO(push.endDate) : "")
    }, [connectingFrom, pushes, onPushesChange])

    // Handle starting a connection from a push
    const handleStartConnection = useCallback((pushId: string) => {
        if (connectingFrom === pushId) {
            // Toggle off
            setConnectingFrom(null)
        } else {
            setConnectingFrom(pushId)
        }
    }, [connectingFrom])

    // Handle edit save
    const handleEditSave = useCallback(() => {
        if (!editingPush) return

        const updates: Partial<PushDraft> = {
            name: editName.trim() || editingPush.name
        }

        if (editStartDate) {
            updates.startDate = new Date(editStartDate)
        }
        if (editEndDate) {
            updates.endDate = new Date(editEndDate)
        }

        onPushesChange(pushes.map(p =>
            p.tempId === editingPush.tempId ? { ...p, ...updates } : p
        ))
        setEditingPush(null)
    }, [editingPush, editName, editStartDate, editEndDate, pushes, onPushesChange])

    const handleUpdatePush = useCallback((id: string, updates: Partial<PushDraft>) => {
        onPushesChange(pushes.map(p => p.tempId === id ? { ...p, ...updates } : p))
    }, [pushes, onPushesChange])

    const handleDeletePush = useCallback((id: string) => {
        // Also remove any dependencies on this push
        onPushesChange(pushes.filter(p => p.tempId !== id).map(p =>
            p.dependsOn === id ? { ...p, dependsOn: null } : p
        ))
        if (selectedPushId === id) setSelectedPushId(null)
        setEditingPush(null)
    }, [pushes, onPushesChange, selectedPushId])

    // Remove dependency from push
    const handleRemoveDependency = useCallback(() => {
        if (!editingPush) return
        onPushesChange(pushes.map(p =>
            p.tempId === editingPush.tempId ? { ...p, dependsOn: null } : p
        ))
        setEditingPush({ ...editingPush, dependsOn: null })
    }, [editingPush, pushes, onPushesChange])

    // Calculate grid height with extra row for new pushes
    const gridHeight = Math.max((pushes.length + 1) * ROW_HEIGHT, MIN_ROWS * ROW_HEIGHT)
    const totalHeight = HEADER_HEIGHT + gridHeight

    // Get dependency lines to draw
    const dependencyLines = useMemo(() => {
        if (!showConnections) return []

        return pushes
            .filter(p => p.dependsOn)
            .map(p => {
                const fromPush = pushes.find(dep => dep.tempId === p.dependsOn)
                if (!fromPush) return null

                const fromIndex = pushes.findIndex(dep => dep.tempId === p.dependsOn)
                const toIndex = pushes.findIndex(dep => dep.tempId === p.tempId)
                const fromEnd = fromPush.endDate || addDays(fromPush.startDate, 14)

                return {
                    fromX: getPositionPercent(fromEnd),
                    fromY: fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
                    toX: getPositionPercent(p.startDate),
                    toY: toIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
                    pushId: p.tempId
                }
            })
            .filter(Boolean) as { fromX: number; fromY: number; toX: number; toY: number; pushId: string }[]
    }, [pushes, showConnections, getPositionPercent])

    // Find dependency name for display
    const getDependencyName = useCallback((dependsOnId: string | undefined | null) => {
        if (!dependsOnId) return null
        const dep = pushes.find(p => p.tempId === dependsOnId)
        return dep?.name || 'Unknown'
    }, [pushes])

    return (
        <TooltipProvider delayDuration={100}>
            <div className="flex flex-col rounded-lg border bg-card overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                            {formatDateShort(viewRange.start)} − {formatDateShort(viewRange.end)}
                        </span>
                    </div>
                    {connectingFrom ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-primary">Select target push</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setConnectingFrom(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            {pushes.length} push{pushes.length !== 1 ? 'es' : ''}
                        </span>
                    )}
                </div>

                {/* Timeline area */}
                <div
                    ref={containerRef}
                    className={cn(
                        "relative select-none",
                        !readOnly && !connectingFrom && "cursor-crosshair",
                        connectingFrom && "cursor-pointer"
                    )}
                    style={{ minHeight: `${Math.max(totalHeight, minHeight)}px` }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Grid with headers */}
                    <TimelineGrid
                        startDate={viewRange.start}
                        endDate={viewRange.end}
                        height={gridHeight}
                    />

                    {/* Push bars */}
                    <div
                        className="absolute left-0 right-0"
                        style={{ top: `${HEADER_HEIGHT}px`, height: `${gridHeight}px` }}
                    >
                        {/* Dependency lines */}
                        {showConnections && (
                            <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 5 }}>
                                {dependencyLines.map((line, i) => (
                                    <g key={i}>
                                        <path
                                            d={`M ${line.fromX}% ${line.fromY} C ${line.fromX + 3}% ${line.fromY}, ${line.toX - 3}% ${line.toY}, ${line.toX}% ${line.toY}`}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeDasharray="4 2"
                                            className="text-muted-foreground/50"
                                        />
                                        <circle
                                            cx={`${line.toX}%`}
                                            cy={line.toY}
                                            r="4"
                                            className="fill-muted-foreground/50"
                                        />
                                    </g>
                                ))}
                            </svg>
                        )}

                        {pushes.map((push, index) => (
                            <TimelineBar
                                key={push.tempId}
                                push={push}
                                timelineStart={viewRange.start}
                                timelineEnd={viewRange.end}
                                onUpdate={handleUpdatePush}
                                onDelete={handleDeletePush}
                                isSelected={selectedPushId === push.tempId}
                                onSelect={setSelectedPushId}
                                onClick={() => handlePushClick(push)}
                                rowIndex={index}
                                readOnly={readOnly}
                                isDependent={!!push.dependsOn}
                                dependencyCompleted={false}
                                onStartConnection={showConnections ? handleStartConnection : undefined}
                                isConnectionSource={connectingFrom === push.tempId}
                                isConnectionTarget={connectingFrom !== null && connectingFrom !== push.tempId}
                            />
                        ))}

                        {/* Creation preview */}
                        {isCreating && hasDragged && createPreview && (
                            <div
                                className="absolute h-9 rounded-lg bg-primary/40 border-2 border-dashed border-primary pointer-events-none"
                                style={{
                                    left: `${getPositionPercent(createPreview.start)}%`,
                                    width: `${Math.max(getPositionPercent(createPreview.end) - getPositionPercent(createPreview.start), 2)}%`,
                                    top: `${pushes.length * ROW_HEIGHT + 6}px`
                                }}
                            />
                        )}
                    </div>

                    {/* Empty state */}
                    {pushes.length === 0 && !isCreating && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: `${HEADER_HEIGHT}px` }}>
                            <p className="text-sm text-muted-foreground">
                                {readOnly ? 'No pushes' : 'Drag to create a push'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Name prompt dialog */}
            <Dialog open={namePromptOpen} onOpenChange={(open) => {
                if (!open) {
                    setNamePromptOpen(false)
                    setPendingPush(null)
                }
            }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Name this push</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={newPushName}
                            onChange={(e) => setNewPushName(e.target.value)}
                            placeholder="Push name"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleNameSubmit()
                            }}
                        />
                        {pendingPush && (
                            <p className="text-xs text-muted-foreground mt-2">
                                {formatDateShort(pendingPush.startDate)} − {formatDateShort(pendingPush.endDate || addDays(pendingPush.startDate, 14))}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNamePromptOpen(false)}>Cancel</Button>
                        <Button onClick={handleNameSubmit} disabled={!newPushName.trim()}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit push dialog */}
            <Dialog open={!!editingPush} onOpenChange={(open) => !open && setEditingPush(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit Push</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Push name"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-start">Start</Label>
                                <Input
                                    id="edit-start"
                                    type="date"
                                    value={editStartDate}
                                    onChange={(e) => setEditStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-end">End</Label>
                                <Input
                                    id="edit-end"
                                    type="date"
                                    value={editEndDate}
                                    onChange={(e) => setEditEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Show dependency if exists */}
                        {editingPush?.dependsOn && (
                            <div className="pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                        Depends on: <span className="font-medium text-foreground">{getDependencyName(editingPush.dependsOn)}</span>
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-destructive hover:text-destructive"
                                        onClick={handleRemoveDependency}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="flex-row justify-between sm:justify-between">
                        <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => editingPush && handleDeletePush(editingPush.tempId)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditingPush(null)}>Cancel</Button>
                            <Button onClick={handleEditSave}>Save</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}
