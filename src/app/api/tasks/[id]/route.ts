import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    try {
        const { id } = await params

        const task = await prisma.task.findUnique({
            where: { id },
            select: {
                id: true,
                pushId: true,
                columnId: true,
                column: {
                    select: {
                        board: { select: { projectId: true } }
                    }
                }
            }
        })

        if (!task?.column?.board?.projectId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        const project = await prisma.project.findUnique({
            where: { id: task.column.board.projectId },
            select: { workspaceId: true }
        })

        if (!project || project.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        return NextResponse.json({
            id: task.id,
            projectId: task.column.board.projectId,
            pushId: task.pushId,
            columnId: task.columnId,
        })
    } catch (error) {
        console.error("Failed to fetch task:", error)
        return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 })
    }
}

