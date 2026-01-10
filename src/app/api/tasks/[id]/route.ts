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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    try {
        const { id } = await params
        const body = await request.json()
        const { assigneeIds } = body

        // Verify task exists and belongs to user's workspace
        const task = await prisma.task.findUnique({
            where: { id },
            select: {
                id: true,
                column: {
                    select: {
                        board: {
                            select: {
                                project: { select: { workspaceId: true } }
                            }
                        }
                    }
                }
            }
        })

        if (!task?.column?.board?.project?.workspaceId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        if (task.column.board.project.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        // Handle assignee updates
        if (assigneeIds && Array.isArray(assigneeIds)) {
            // Verify all assignees belong to the same workspace
            const validUsers = await prisma.user.findMany({
                where: {
                    id: { in: assigneeIds },
                    workspaceId: user.workspaceId
                },
                select: { id: true }
            })

            const validUserIds = validUsers.map(u => u.id)

            // Update task assignees
            await prisma.$transaction(async (tx) => {
                // Remove existing assignees
                await tx.taskAssignee.deleteMany({
                    where: { taskId: id }
                })

                // Add new assignees (only valid ones from same workspace)
                if (validUserIds.length > 0) {
                    await tx.taskAssignee.createMany({
                        data: validUserIds.map(userId => ({
                            taskId: id,
                            userId
                        }))
                    })

                    // Also update the legacy assigneeId field with first assignee
                    await tx.task.update({
                        where: { id },
                        data: { assigneeId: validUserIds[0] }
                    })
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to update task:", error)
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
    }
}

