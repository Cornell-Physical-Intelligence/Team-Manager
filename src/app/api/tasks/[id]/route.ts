import { NextResponse } from "next/server"
import { api, fetchMutation, fetchQuery } from "@/lib/convex/server"
import { getCurrentUser } from "@/lib/auth"

type TaskDoc = {
    id: string
    title: string
    description?: string
    status: string
    assigneeId?: string
    pushId?: string
    columnId?: string
    subteamId?: string
    priority: string
    requireAttachment: boolean
    attachmentFolderId?: string
    attachmentFolderName?: string
    instructionsFileUrl?: string
    instructionsFileName?: string
    progress: number
    enableProgress: boolean
    startDate?: number
    endDate?: number
    dueDate?: number
    submittedAt?: number
    approvedAt?: number
    createdAt: number
    updatedAt: number
}

type TaskMeta = {
    id: string
    projectId: string
    pushId?: string | null
    columnId?: string | null
}

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
        const task = await fetchQuery(api.tasks.getMeta, {
            taskId: id,
            workspaceId: user.workspaceId,
        }) as TaskMeta | null

        if (!task?.projectId) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        return NextResponse.json({
            id: task.id,
            projectId: task.projectId,
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
        const taskMeta = await fetchQuery(api.tasks.getMeta, {
            taskId: id,
            workspaceId: user.workspaceId,
        }) as TaskMeta | null

        if (!taskMeta) {
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

            const validUserIds = await fetchQuery(api.workspaces.getWorkspaceUserIds, {
                userIds: normalizedAssigneeIds,
                workspaceId: user.workspaceId,
            }) as string[]

            if (validUserIds.length !== normalizedAssigneeIds.length) {
                return NextResponse.json({ error: "One or more assignees are not in this workspace" }, { status: 400 })
            }

            // Fetch the full task doc to preserve all fields
            const task = await fetchQuery(api.tasks.getTaskById, { taskId: id }) as TaskDoc | null

            if (!task) {
                return NextResponse.json({ error: "Task not found" }, { status: 404 })
            }

            await fetchMutation(api.mirror.upsertTask, {
                task: {
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status || "Todo",
                    assigneeId: validUserIds[0] ?? undefined,
                    pushId: task.pushId,
                    columnId: task.columnId,
                    subteamId: task.subteamId,
                    priority: task.priority || "Medium",
                    requireAttachment: task.requireAttachment ?? true,
                    attachmentFolderId: task.attachmentFolderId,
                    attachmentFolderName: task.attachmentFolderName,
                    instructionsFileUrl: task.instructionsFileUrl,
                    instructionsFileName: task.instructionsFileName,
                    progress: task.progress ?? 0,
                    enableProgress: task.enableProgress ?? false,
                    startDate: task.startDate,
                    endDate: task.endDate,
                    dueDate: task.dueDate,
                    submittedAt: task.submittedAt,
                    approvedAt: task.approvedAt,
                    createdAt: task.createdAt,
                    updatedAt: Date.now(),
                },
                assigneeIds: validUserIds,
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to update task:", error)
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
    }
}
