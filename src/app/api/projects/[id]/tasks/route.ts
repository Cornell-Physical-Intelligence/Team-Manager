import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { api, fetchQuery } from "@/lib/convex/server"

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
        const pushIdParam = searchParams.get("pushId")
        const pushId = pushIdParam && pushIdParam.trim().length > 0
            ? (pushIdParam === "null" || pushIdParam === "backlog" ? null : pushIdParam)
            : undefined

        const project = await fetchQuery(api.projects.getContext, {
            projectId,
        })

        if (!project || project.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: "Division not found" }, { status: 404 })
        }

        const lean = searchParams.get("lean") === "true"
        const tasks = lean
            ? await fetchQuery(api.tasks.getLeanProjectTasks, { projectId, pushId })
            : await fetchQuery(api.tasks.getProjectTasks, { projectId, pushId })

        return NextResponse.json({ tasks })
    } catch (error) {
        console.error("Failed to fetch division tasks:", error)
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }
}
