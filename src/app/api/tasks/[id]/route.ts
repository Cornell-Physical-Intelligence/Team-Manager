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
        const { assigneeIds } = body as { assigneeIds?: unknown }

        if (assigneeIds !== undefined && !Array.isArray(assigneeIds)) {
            return NextResponse.json({ error: "assigneeIds must be an array" }, { status: 400 })
        }

        if (Array.isArray(assigneeIds) && assigneeIds.some((id) => typeof id !== "string")) {
            return NextResponse.json({ error: "assigneeIds must contain only strings" }, { status: 400 })
        }

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
                },
                push: {
                    select: {
                        project: { select: { workspaceId: true } }
                    }
                }
            }
        })

        const taskWorkspaceId = task?.column?.board?.project?.workspaceId ?? task?.push?.project?.workspaceId

        if (!taskWorkspaceId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        if (taskWorkspaceId !== user.workspaceId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        // Handle assignee updates
        if (Array.isArray(assigneeIds)) {
            const normalizedAssigneeIds = Array.from(
                new Set(
                    assigneeIds
                        .map((id) => id.trim())
                        .filter((id) => id.length > 0)
                )
            )

            const validUsers = await prisma.workspaceMember.findMany({
                where: {
                    workspaceId: user.workspaceId,
                    userId: { in: normalizedAssigneeIds }
                },
                select: { userId: true }
            })

            const validUserIds = validUsers.map(u => u.userId)
            if (validUserIds.length !== normalizedAssigneeIds.length) {
                return NextResponse.json({ error: "One or more assignees are not in this workspace" }, { status: 400 })
            }

            // Update task assignees
            await prisma.$transaction(async (tx) => {
                // Remove existing assignees
                await tx.taskAssignee.deleteMany({
                    where: { taskId: id }
                })

                // Add new assignees
                if (validUserIds.length > 0) {
                    await tx.taskAssignee.createMany({
                        data: validUserIds.map(userId => ({
                            taskId: id,
                            userId
                        }))
                    })
                }

                // Keep legacy field synchronized, including explicit unassign.
                await tx.task.update({
                    where: { id },
                    data: { assigneeId: validUserIds[0] ?? null }
                })
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to update task:", error)
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
    }
}
