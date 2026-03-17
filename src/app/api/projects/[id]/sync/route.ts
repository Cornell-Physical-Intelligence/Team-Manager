import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { api, fetchQuery } from "@/lib/convex/server"

// Lightweight sync endpoint - returns only what changed since last check
// Used for real-time updates without heavy data transfer
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    try {
        const { id: projectId } = await params
        const { searchParams } = new URL(request.url)
        const since = searchParams.get("since") // ISO timestamp
        const cursorParam = searchParams.get("cursor")
        const limitParam = searchParams.get("limit")

        const limit = Math.min(200, Math.max(1, Number(limitParam) || 100))
        const syncData = await fetchQuery(api.projects.getBoardDelta, {
            projectId,
            workspaceId: user.workspaceId,
            since: since || undefined,
            cursor: cursorParam || undefined,
            limit,
        })

        if (!syncData) {
            return NextResponse.json({ error: "Division not found or access denied" }, { status: 404 })
        }

        return NextResponse.json(syncData)
    } catch (error) {
        console.error("Failed to sync division:", error)
        return NextResponse.json({ error: "Failed to sync" }, { status: 500 })
    }
}
