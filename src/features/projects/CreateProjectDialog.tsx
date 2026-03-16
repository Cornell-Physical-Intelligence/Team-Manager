"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createProject } from "@/app/actions/projects"
import { useState, useTransition } from "react"
import { ChevronDown, Plus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type User = {
    id: string
    name: string
    role: string
}

type Props = {
    users: User[]
}

export function CreateProjectDialog({ users }: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [leadIds, setLeadIds] = useState<string[]>([])
    const { toast } = useToast()
    const selectedLeadNames = users.filter((user) => leadIds.includes(user.id)).map((user) => user.name)

    async function handleSubmit(formData: FormData) {
        if (leadIds.length === 0) {
            toast({ title: "Error", description: "At least one division lead is required", variant: "destructive" })
            return
        }

        formData.delete('leadId')
        formData.delete('leadIds')
        leadIds.forEach((leadId) => formData.append('leadIds', leadId))

        startTransition(async () => {
            const result = await createProject(formData)

            if (result?.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" })
            } else {
                toast({ title: "Division Created" })
                setOpen(false)
                setLeadIds([])
            }
        })
    }

    const toggleLead = (userId: string) => {
        setLeadIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Division
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    if (isPending) return;
                    const formData = new FormData(e.currentTarget);
                    handleSubmit(formData);
                }}>
                    <DialogHeader>
                        <DialogTitle>Create Division</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" name="name" required autoComplete="off" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" autoComplete="off" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="flex items-center gap-1">
                                Division Leads <span className="text-red-500">*</span>
                            </Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={leadIds.length === 0 ? "justify-between border-red-300" : "justify-between"}>
                                        <span className="truncate">
                                            {selectedLeadNames.length === 0
                                                ? "Select division leads"
                                                : selectedLeadNames.length <= 2
                                                    ? selectedLeadNames.join(', ')
                                                    : `${selectedLeadNames.length} leads selected`}
                                        </span>
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[260px] p-1" align="start">
                                    {users.map(user => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent cursor-pointer"
                                            onClick={() => toggleLead(user.id)}
                                        >
                                            <Checkbox checked={leadIds.includes(user.id)} />
                                            <span className="text-sm">{user.name} ({user.role})</span>
                                        </div>
                                    ))}
                                </PopoverContent>
                            </Popover>
                            {leadIds.length === 0 && (
                                <p className="text-xs text-red-500">At least one division lead is required</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Creating...' : 'Create Division'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

