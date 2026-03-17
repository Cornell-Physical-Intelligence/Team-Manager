import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { reorderWorkspaceProjects } from "@/lib/convex/projects"

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.id || user.id === "pending" || !user.workspaceId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const body = await request.json().catch(() => null)
        const projectIdsRaw = body?.projectIds
        if (!Array.isArray(projectIdsRaw)) {
            return NextResponse.json({ error: "divisionIds must be an array" }, { status: 400 })
        }

        const projectIds = Array.from(
            new Set(
                projectIdsRaw.filter((entry: unknown) => typeof entry === "string" && entry.trim().length > 0)
            )
        )
        if (projectIds.length === 0) {
            return NextResponse.json({ error: "divisionIds cannot be empty" }, { status: 400 })
        }

        const result = await reorderWorkspaceProjects({
            userId: user.id,
            workspaceId: user.workspaceId,
            projectIds,
        })

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: 403 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to update division order:", error)
        return NextResponse.json({ error: "Failed to update division order" }, { status: 500 })
    }
}
