import { notFound } from "next/navigation"
import { ProjectContent } from "@/features/projects/ProjectContent"
import { getCurrentUser } from "@/lib/auth"
import { api, fetchQuery } from "@/lib/convex/server"

interface ProjectPageProps {
    params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
    const currentUser = await getCurrentUser()
    if (!currentUser?.workspaceId) {
        notFound()
    }

    const { id } = await params

    const pageData = await fetchQuery(api.projects.getPageData, {
        projectId: id,
        workspaceId: currentUser.workspaceId,
    })

    if (!pageData) {
        notFound()
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
