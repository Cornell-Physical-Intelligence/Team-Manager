"use client"

import { type Preloaded, usePreloadedQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import { ProjectContent } from "@/features/projects/ProjectContent"

export function ProjectPageClient({
    preloadedPageData,
}: {
    preloadedPageData: Preloaded<typeof api.projects.getPageData>
}) {
    const pageData = usePreloadedQuery(preloadedPageData)

    if (!pageData) {
        return <div className="p-6 text-muted-foreground">Division not found.</div>
    }

    return (
        <ProjectContent
            project={pageData.project}
            board={pageData.board}
            users={pageData.users}
            pushes={pageData.pushes}
        />
    )
}
