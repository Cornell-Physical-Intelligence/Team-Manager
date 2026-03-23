"use client"

import { type Preloaded, usePreloadedQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { useDashboardUser } from "@/components/DashboardUserProvider"
import { PersonalKanban } from "./PersonalKanban"

export function MyBoardPageClient({
    preloadedPageData,
}: {
    preloadedPageData: Preloaded<typeof api.dashboard.getMyBoardPageData>
}) {
    const user = useDashboardUser()
    const pageData = usePreloadedQuery(preloadedPageData)

    if (!user?.id || user.id === "pending") {
        return <div className="p-6 text-muted-foreground">Please complete your profile setup.</div>
    }

    if (!user.workspaceId) {
        return null
    }

    const { columns, projects } = pageData

    return (
        <div className="flex min-h-full flex-col bg-background md:bg-transparent">
            <PersonalKanban
                columns={columns}
                projects={projects}
                userName={user.name?.split(" ")[0] || "User"}
            />
        </div>
    )
}
