import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.redirect(new URL("/", request.url))
    }

    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
            id: true,
            column: {
                select: {
                    board: {
                        select: {
                            projectId: true,
                            project: { select: { workspaceId: true } }
                        }
                    }
                }
            }
        }
    })

    const projectId = task?.column?.board?.projectId
    const taskWorkspaceId = task?.column?.board?.project?.workspaceId
    if (!projectId || !taskWorkspaceId || taskWorkspaceId !== user.workspaceId) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.redirect(
        new URL(`/dashboard/projects/${projectId}?task=${taskId}`, request.url)
    )
}
