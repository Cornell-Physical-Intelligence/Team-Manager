"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { updateProjectLead } from "@/app/actions/projects"
import { useState, useTransition } from "react"
import { ChevronDown, User } from "lucide-react"

type Props = {
    projectId: string
    currentLeadIds: string[]
    users: { id: string; name: string; role: string }[]
    isAdmin: boolean
}

export function ProjectLeadSelect({ projectId, currentLeadIds, users, isAdmin }: Props) {
    const [isPending, startTransition] = useTransition()
    const [leadIds, setLeadIds] = useState(currentLeadIds)
    const currentLeadNames = users.filter((user) => leadIds.includes(user.id)).map((user) => user.name)

    const handleToggle = (userId: string) => {
        const nextLeadIds = leadIds.includes(userId)
            ? leadIds.filter((id) => id !== userId)
            : [...leadIds, userId]
        setLeadIds(nextLeadIds)
        startTransition(async () => {
            await updateProjectLead(projectId, nextLeadIds)
        })
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Leads: {currentLeadNames.join(', ') || 'None'}</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 w-[220px] justify-between" disabled={isPending}>
                        <span className="truncate">
                            {currentLeadNames.length === 0
                                ? "Select leads"
                                : currentLeadNames.length <= 2
                                    ? currentLeadNames.join(', ')
                                    : `${currentLeadNames.length} leads selected`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-1" align="start">
                    {users.map(user => (
                        <div
                            key={user.id}
                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent cursor-pointer"
                            onClick={() => handleToggle(user.id)}
                        >
                            <Checkbox checked={leadIds.includes(user.id)} />
                            <span className="text-sm">{user.name}</span>
                        </div>
                    ))}
                </PopoverContent>
            </Popover>
        </div>
    )
}
