import { getCurrentUser } from '@/lib/auth'
import { redirect } from "next/navigation"
import { fetchDashboardMyBoardPageData } from "@/lib/convex/dashboard"
import { PersonalKanban } from "./PersonalKanban"

export const dynamic = 'force-dynamic'

export default async function MyBoardPage() {
    const user = await getCurrentUser()

    if (!user || !user.id || user.id === 'pending') {
        return <div className="p-6 text-muted-foreground">Please complete your profile setup.</div>
    }

    if (!user.workspaceId) {
        redirect("/workspaces")
    }

    const { columns, projects } = await fetchDashboardMyBoardPageData({
        userId: user.id,
        workspaceId: user.workspaceId,
    })

    return (
        <div className="flex min-h-full flex-col bg-background md:bg-transparent">
            <PersonalKanban
                columns={columns}
                projects={projects}
                userName={user.name?.split(' ')[0] || 'User'}
            />
        </div>
    )
}
