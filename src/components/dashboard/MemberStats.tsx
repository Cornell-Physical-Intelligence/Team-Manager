"use client"

import { CheckCircle2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type MemberStat = {
    userId: string
    userName: string
    userAvatar?: string | null
    role: string
    completedTasks: number
    inProgressTasks: number
    todoTasks: number
    totalTasks: number
}

type MemberStatsProps = {
    stats: MemberStat[]
}

export function MemberStats({ stats }: MemberStatsProps) {
    // Sort by most completions
    const sortedStats = [...stats].sort((a, b) => b.completedTasks - a.completedTasks)

    return (
        <div className="space-y-1">
            {sortedStats.map(stat => (
                <div key={stat.userId} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={stat.userAvatar || undefined} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                {stat.userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">
                            {stat.userName}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{stat.completedTasks}</span>
                        <CheckCircle2 className="w-3 h-3 text-green-500 opacity-70" />
                    </div>
                </div>
            ))}
        </div>
    )
}
