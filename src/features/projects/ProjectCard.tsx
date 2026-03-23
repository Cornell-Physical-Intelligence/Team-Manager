"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { updateProjectLead } from "@/app/actions/projects"
import { useState, useTransition } from "react"
import { ChevronDown, User, ExternalLink } from "lucide-react"
import Link from "next/link"

function hexToRgba(hex: string, alpha: number) {
    const n = hex.trim().replace(/^#/, "")
    const r = parseInt(n.slice(0, 2), 16)
    const g = parseInt(n.slice(2, 4), 16)
    const b = parseInt(n.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

type Project = {
    id: string
    name: string
    description: string | null
    leadId: string | null
    lead: { id: string; name: string } | null
    leadIds: string[]
    leads: { id: string; name: string }[]
    _count: { pushes: number }
}

type Props = {
    project: Project
    users: { id: string; name: string; role: string }[]
    isAdmin: boolean
    taskCount?: number
    projectColor?: string | null
}

export function ProjectCard({ project, users, isAdmin, taskCount = 0, projectColor }: Props) {
    const [isPending, startTransition] = useTransition()
    const [leadIds, setLeadIds] = useState(project.leadIds || [])
    const selectedLeadNames = users.filter((user) => leadIds.includes(user.id)).map((user) => user.name)

    const handleLeadToggle = (userId: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const nextLeadIds = leadIds.includes(userId)
            ? leadIds.filter((id) => id !== userId)
            : [...leadIds, userId]
        setLeadIds(nextLeadIds)
        startTransition(async () => {
            await updateProjectLead(project.id, nextLeadIds)
        })
    }

    const badgeColor = projectColor || '#3b82f6'

    return (
        <Card className="hover:bg-muted/50 transition-colors h-full group relative">
            <Link href={`/dashboard/projects/${project.id}`} className="absolute inset-0 z-0" />
            {taskCount > 0 && (
                <span
                    className="absolute -top-2 -left-2 z-20 flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold leading-none pointer-events-none"
                    style={{
                        backgroundColor: hexToRgba(badgeColor, 0.35),
                        color: 'rgba(0,0,0,0.85)',
                    }}
                >
                    {taskCount > 99 ? '99' : taskCount}
                </span>
            )}
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium line-clamp-1">{project.name}</CardTitle>
                </div>
                <CardDescription className="text-xs line-clamp-1">
                    {project.description || "No description"}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project._count.pushes} project{project._count.pushes !== 1 ? 's' : ''}</span>
                    {isAdmin ? (
                        <div
                            className="relative z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" className="h-6 w-[150px] justify-between px-2 text-xs" disabled={isPending}>
                                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                            <User className="h-3 w-3 shrink-0" />
                                            <span className="truncate">
                                                {selectedLeadNames.length === 0
                                                    ? "Select leads"
                                                    : selectedLeadNames.length <= 2
                                                        ? selectedLeadNames.join(', ')
                                                        : `${selectedLeadNames.length} leads`}
                                            </span>
                                        </span>
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[220px] p-1" align="start">
                                    {users.map(u => (
                                        <div
                                            key={u.id}
                                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent cursor-pointer"
                                            onClick={(e) => handleLeadToggle(u.id, e as unknown as React.MouseEvent)}
                                        >
                                            <Checkbox checked={leadIds.includes(u.id)} />
                                            <span className="text-sm">{u.name}</span>
                                        </div>
                                    ))}
                                </PopoverContent>
                            </Popover>
                        </div>
                    ) : selectedLeadNames.length > 0 ? (
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{selectedLeadNames.join(', ')}</span>
                        </div>
                    ) : null}
                </div>
            </CardContent>
            <Link
                href={`/dashboard/projects/${project.id}`}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
                <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Link>
        </Card>
    )
}
