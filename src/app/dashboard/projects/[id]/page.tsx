import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { api, preloadQuery } from "@/lib/convex/server"
import { ProjectPageClient } from "@/features/projects/ProjectPageClient"

interface ProjectPageProps {
    params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
    const user = await getCurrentUser()
    if (!user) {
        redirect("/")
    }
    if (!user.workspaceId) {
        redirect("/workspaces")
    }

    const { id } = await params
    const preloadedPageData = await preloadQuery(api.projects.getPageData, {
        projectId: id,
        workspaceId: user.workspaceId,
    })

    return <ProjectPageClient preloadedPageData={preloadedPageData} />
}
