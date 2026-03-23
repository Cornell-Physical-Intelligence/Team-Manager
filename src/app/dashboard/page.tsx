import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { api, preloadQuery } from "@/lib/convex/server"
import { DashboardPageClient } from "./DashboardPageClient"
import { readInviteNotice } from "@/lib/invite-status"

type SearchParams = Record<string, string | string[] | undefined>

export default async function DashboardPage({
    searchParams,
}: {
    searchParams?: Promise<SearchParams>
}) {
    const user = await getCurrentUser()
    if (!user) {
        redirect("/")
    }
    if (!user.workspaceId) {
        redirect("/workspaces")
    }

    const inviteNotice = readInviteNotice(searchParams ? await searchParams : null)
    if (!user.id || user.id === "pending") {
        return <div className="p-6 text-muted-foreground">Please complete your profile setup.</div>
    }

    const preloadedPageData = await preloadQuery(api.dashboard.getDashboardPageData, {
        userId: user.id,
        workspaceId: user.workspaceId,
        role: user.role,
    })

    return <DashboardPageClient inviteNotice={inviteNotice} preloadedPageData={preloadedPageData} />
}
