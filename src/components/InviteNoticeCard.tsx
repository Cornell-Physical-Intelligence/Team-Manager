"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { InviteNotice } from "@/lib/invite-status"
import { AlertTriangle, CheckCircle2, Info } from "lucide-react"

const inviteNoticeStyles = {
    joined: {
        container: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-950 dark:bg-emerald-400/[0.06] dark:text-emerald-50",
        iconClass: "text-emerald-700 dark:text-emerald-300",
        icon: CheckCircle2,
        title: "Invite accepted",
        description: (workspaceName?: string | null) =>
            workspaceName
                ? `You're in ${workspaceName}.`
                : "Your invite link worked and you can keep going.",
    },
    "already-member": {
        container: "border-sky-500/20 bg-sky-500/[0.05] text-sky-950 dark:bg-sky-400/[0.06] dark:text-sky-50",
        iconClass: "text-sky-700 dark:text-sky-300",
        icon: Info,
        title: "Already in this workspace",
        description: (workspaceName?: string | null) =>
            workspaceName
                ? `You're already a member of ${workspaceName}. We opened it for you.`
                : "You're already a member here. We opened it for you.",
    },
    invalid: {
        container: "border-amber-500/20 bg-amber-500/[0.06] text-amber-950 dark:bg-amber-400/[0.08] dark:text-amber-50",
        iconClass: "text-amber-800 dark:text-amber-200",
        icon: AlertTriangle,
        title: "Invite link unavailable",
        description: () => "This invite link is invalid or expired. Ask a workspace admin for a fresh one.",
    },
} as const

export function InviteNoticeCard({
    notice,
    className,
}: {
    notice: InviteNotice
    className?: string
}) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isLeaving, setIsLeaving] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const variant = inviteNoticeStyles[notice.status]
    const Icon = variant.icon
    const cleanedUrl = useMemo(() => {
        if (!pathname) return null

        const nextParams = new URLSearchParams(searchParams?.toString() || "")
        nextParams.delete("inviteStatus")
        nextParams.delete("inviteWorkspace")

        const query = nextParams.toString()
        return query ? `${pathname}?${query}` : pathname
    }, [pathname, searchParams])

    useEffect(() => {
        const fadeTimer = window.setTimeout(() => {
            setIsLeaving(true)
        }, 2800)

        const dismissTimer = window.setTimeout(() => {
            if (cleanedUrl) {
                window.history.replaceState(window.history.state, "", `${cleanedUrl}${window.location.hash}`)
            }
            setDismissed(true)
        }, 3600)

        return () => {
            window.clearTimeout(fadeTimer)
            window.clearTimeout(dismissTimer)
        }
    }, [cleanedUrl])

    if (dismissed) {
        return null
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "w-full overflow-hidden rounded-xl border shadow-sm backdrop-blur-xl transition-all duration-500",
                "px-4 py-3",
                variant.container,
                isLeaving ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100",
                className
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn("mt-0.5 rounded-full border border-current/10 bg-background/80 p-2 shadow-sm", variant.iconClass)}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight">{variant.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {variant.description(notice.workspaceName)}
                    </p>
                </div>
            </div>
        </div>
    )
}
