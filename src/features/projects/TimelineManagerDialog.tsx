"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TimelineEditor } from "@/features/timeline-editor/TimelineEditor"
import { type PushDraft } from "@/features/timeline-editor/types"
import { createPush, updatePush, deletePush } from "@/app/actions/pushes"
import { Loader2, Save } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type PushType = {
    id: string
    name: string
    startDate: Date | string
    endDate: Date | string | null
    status: string
    color?: string
}

interface TimelineManagerDialogProps {
    projectId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    initialPushes: PushType[]
}

export function TimelineManagerDialog({
    projectId,
    open,
    onOpenChange,
    initialPushes
}: TimelineManagerDialogProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isPending, startTransition] = useTransition()
    const [pushes, setPushes] = useState<PushDraft[]>([])
    const [hasChanges, setHasChanges] = useState(false)

    // Sync initial pushes to local state when dialog opens
    useEffect(() => {
        if (open) {
            setPushes(initialPushes.map(p => ({
                tempId: p.id, // Using real ID as tempId for existing pushes
                name: p.name,
                startDate: new Date(p.startDate),
                endDate: p.endDate ? new Date(p.endDate) : null,
                color: p.color || "#3b82f6",
                // We don't have dependency info in current PushType, 
                // but we could add it if the API supports it.
            })))
            setHasChanges(false)
        }
    }, [open, initialPushes])

    const handlePushesChange = (newPushes: PushDraft[]) => {
        setPushes(newPushes)
        setHasChanges(true)
    }

    const handleSave = () => {
        startTransition(async () => {
            try {
                // In a real implementation, we would diff and batch update.
                // For this MVP, we'll identify new vs updated vs deleted.

                const deletedPushIds = initialPushes
                    .filter(p => !pushes.some(dp => dp.tempId === p.id))
                    .map(p => p.id)

                const updatedPushes = pushes.filter(p => initialPushes.some(ip => ip.id === p.tempId))
                const newPushes = pushes.filter(p => !initialPushes.some(ip => ip.id === p.tempId))

                // Perform deletions
                for (const id of deletedPushIds) {
                    await deletePush(id, projectId)
                }

                // Perform updates
                for (const p of updatedPushes) {
                    await updatePush({
                        id: p.tempId,
                        name: p.name,
                        startDate: p.startDate.toISOString().split('T')[0],
                        endDate: p.endDate?.toISOString().split('T')[0] || null,
                        color: p.color
                    })
                }

                // Perform creations
                for (const p of newPushes) {
                    const formData = new FormData()
                    formData.append('name', p.name)
                    formData.append('projectId', projectId)
                    formData.append('startDate', p.startDate.toISOString().split('T')[0])
                    if (p.endDate) formData.append('endDate', p.endDate.toISOString().split('T')[0])
                    if (p.color) formData.append('color', p.color)
                    await createPush(formData)
                }

                toast({
                    title: "Success",
                    description: "Timeline saved successfully",
                })
                router.refresh()
                onOpenChange(false)
            } catch (err) {
                console.error("Failed to save timeline:", err)
                toast({
                    title: "Error",
                    description: "Failed to save timeline",
                    variant: "destructive",
                })
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle>Project Timeline</DialogTitle>
                        <DialogDescription className="sr-only">Visual editor for managing project pushes and their timeline.</DialogDescription>
                        <div className="flex items-center gap-2 pr-8">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={!hasChanges || isPending}
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-6">
                    <TimelineEditor
                        pushes={pushes}
                        onPushesChange={handlePushesChange}
                        minHeight={500}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
