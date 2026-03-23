import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { api, preloadQuery } from "@/lib/convex/server"
import { MyBoardPageClient } from "./MyBoardPageClient"

export default async function MyBoardPage() {
    const user = await getCurrentUser()
    if (!user) {
        redirect("/")
    }
    if (!user.workspaceId) {
        redirect("/workspaces")
    }
    if (!user.id || user.id === "pending") {
        return <div className="p-6 text-muted-foreground">Please complete your profile setup.</div>
    }

    const preloadedPageData = await preloadQuery(api.dashboard.getMyBoardPageData, {
        userId: user.id,
        workspaceId: user.workspaceId,
    })

    return <MyBoardPageClient preloadedPageData={preloadedPageData} />
}
