import { redirect } from 'next/navigation'
import { getCurrentUser } from "@/lib/auth"
import { fetchDashboardProjectsTarget } from "@/lib/convex/dashboard"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    const user = await getCurrentUser()
    if (!user?.workspaceId || !user.id) {
        redirect("/")
    }

    const projectId = await fetchDashboardProjectsTarget({
        userId: user.id,
        workspaceId: user.workspaceId,
        role: user.role,
    })

    if (projectId) {
        redirect(`/dashboard/projects/${projectId}`)
    }

    // If no active projects, show a message
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 text-center animate-fade-in-up">
            <h2 className="text-base md:text-lg font-semibold mb-2">No Active Divisions</h2>
            <p className="text-xs md:text-sm text-muted-foreground">
                Create a new division using the + button in the sidebar, or open the Archived section to restore one.
            </p>
        </div>
    )
}
