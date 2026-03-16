import { redirect } from 'next/navigation'
import prisma from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    // Get the first active project and redirect to it
    const project = await prisma.project.findFirst({
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' }
    })

    if (project) {
        redirect(`/dashboard/projects/${project.id}`)
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
