import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { api, fetchQuery } from "@/lib/convex/server"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.redirect(new URL("/", request.url))
    }

    // getMeta returns null if task doesn't exist or workspaceId doesn't match
    const taskMeta = await fetchQuery(api.tasks.getMeta, {
        taskId,
        workspaceId: user.workspaceId,
    })

    if (!taskMeta) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    const projectId = taskMeta.projectId
    if (!projectId) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.redirect(
        new URL(`/dashboard/projects/${projectId}?task=${taskId}`, request.url)
    )
}
