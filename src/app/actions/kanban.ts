'use server'

import { revalidatePath } from 'next/cache'
import { sendDiscordNotification } from '@/lib/discord'
import { getCurrentUser } from '@/lib/auth'
import { getProjectContext, getWorkspaceUserIds } from '@/lib/access'
import { resolveProjectColumnId } from '@/lib/kanban-columns'
import { driveConfigTableExists, getDriveFolderCache, isFolderWithinRoot } from '@/lib/googleDrive'
import { getWorkspaceProjectColumns } from '@/lib/convex/projects'
import { appendActivityLogToConvex } from '@/lib/convex/mirror'
import {
    createTaskInConvex,
    updateTaskStatusInConvex,
    updateTaskDetailsInConvex,
    deleteTaskInConvex,
    updateTaskProgressInConvex,
} from '@/lib/convex/kanban'
import { api, fetchMutation, fetchQuery } from '@/lib/convex/server'

function parseDateOnlyStart(dateStr: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
    if (!match) return null
    const year = Number(match[1])
    const monthIndex = Number(match[2]) - 1
    const day = Number(match[3])
    return new Date(year, monthIndex, day, 0, 0, 0, 0)
}

function parseDateInput(dateStr: string, mode: "startOfDay" | "endOfDay") {
    const dateOnly = parseDateOnlyStart(dateStr)
    if (dateOnly) {
        if (mode === "endOfDay") {
            dateOnly.setHours(23, 59, 59, 999)
        }
        return dateOnly
    }
    return new Date(dateStr)
}

function parseDueDateInput(dateStr: string | null | undefined) {
    if (!dateStr) return null
    const time = parseDateInput(dateStr, "endOfDay").getTime()
    return Number.isFinite(time) ? time : null
}

type CreateTaskInput = {
    title: string
    projectId: string
    boardId?: string
    columnId?: string | null
    dueDate?: string | null
    description?: string
    assigneeId?: string
    assigneeIds?: string[]
    requireAttachment?: boolean
    enableProgress?: boolean
    progress?: number
    pushId?: string
    attachmentFolderId?: string | null
    attachmentFolderName?: string | null
}

type RawTaskDoc = {
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

function getResultError(result: unknown) {
    if (result && typeof result === 'object' && 'error' in result) {
        const error = (result as { error?: unknown }).error
        return typeof error === 'string' ? error : null
    }
    return null
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return typeof error === 'string' ? error : null
}

function isDateFieldValidatorError(error: string | null) {
    if (!error) return false
    return (
        error.includes('extra field `dueDate`') ||
        error.includes("extra field 'dueDate'") ||
        error.includes('extra field `endDate`') ||
        error.includes("extra field 'endDate'")
    )
}

function toDueDateIso(dueDateMs: number | null | undefined) {
    return typeof dueDateMs === 'number' ? new Date(dueDateMs).toISOString() : null
}

function withDueDateOverride<T>(task: T, dueDateMs: number | null | undefined, shouldOverride: boolean): T {
    if (!shouldOverride || !task || typeof task !== 'object') {
        return task
    }

    const dueDateIso = toDueDateIso(dueDateMs)
    return {
        ...(task as Record<string, unknown>),
        dueDate: dueDateIso,
        endDate: dueDateIso,
    } as T
}

async function getWorkspaceDriveConfig(workspaceId: string) {
    if (!(await driveConfigTableExists())) return null
    return fetchQuery(api.settings.getWorkspaceDriveConfig, { workspaceId })
}

async function getHydratedTask(taskId: string) {
    return fetchQuery(api.tasks.getById, { taskId })
}

async function getRawTask(taskId: string) {
    return fetchQuery(api.tasks.getTaskById, { taskId }) as Promise<RawTaskDoc | null>
}

async function setTaskDueDateViaMirror(
    taskId: string,
    dueDateMs: number,
    changedBy: string,
    changedByName: string
) {
    const task = await getRawTask(taskId)
    if (!task) {
        return { error: 'Task not found' }
    }

    const previousDueAt = typeof task.dueDate === 'number'
        ? task.dueDate
        : typeof task.endDate === 'number'
            ? task.endDate
            : null
    const updatedAt = Date.now()

    await fetchMutation(api.mirror.upsertTask, {
        task: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status || 'Todo',
            assigneeId: task.assigneeId,
            pushId: task.pushId,
            columnId: task.columnId,
            subteamId: task.subteamId,
            priority: task.priority || 'Medium',
            requireAttachment: task.requireAttachment ?? true,
            attachmentFolderId: task.attachmentFolderId,
            attachmentFolderName: task.attachmentFolderName,
            instructionsFileUrl: task.instructionsFileUrl,
            instructionsFileName: task.instructionsFileName,
            progress: task.progress ?? 0,
            enableProgress: task.enableProgress ?? false,
            startDate: task.startDate,
            endDate: dueDateMs,
            dueDate: dueDateMs,
            submittedAt: task.submittedAt,
            approvedAt: task.approvedAt,
            createdAt: task.createdAt,
            updatedAt,
        },
    })

    const oldDueDate = previousDueAt ? new Date(previousDueAt).toISOString().split('T')[0] : 'None'
    const newDueDate = new Date(dueDateMs).toISOString().split('T')[0]
    if (oldDueDate !== newDueDate) {
        await appendActivityLogToConvex({
            taskId: task.id,
            taskTitle: task.title,
            action: 'updated',
            field: 'dueDate',
            oldValue: oldDueDate,
            newValue: newDueDate,
            changedBy,
            changedByName,
        })
    }

    return { success: true as const }
}

async function resolveTaskStatusColumnId(
    columnId: string,
    projectId: string,
    workspaceId: string
) {
    if (!columnId || columnId.startsWith("column_")) {
        return columnId
    }

    const projectColumns = await getWorkspaceProjectColumns(projectId, workspaceId)
    if (!projectColumns || projectColumns.length === 0) {
        return columnId
    }

    return resolveProjectColumnId(columnId, projectColumns) ?? columnId
}

// ─────────────────────────────────────────────────────────────
// createTask
// ─────────────────────────────────────────────────────────────

export async function createTask(input: CreateTaskInput) {

    const { title, projectId, columnId, dueDate, description, assigneeId, pushId } = input

    if (!title || !projectId) {
        return { error: 'Title and Project are required' }
    }

    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return { error: 'Unauthorized' }
        }

        const projectContext = await getProjectContext(projectId)
        if (!projectContext || projectContext.workspaceId !== user.workspaceId) {
            return { error: 'Project not found' }
        }

        const userIdsToCheck = [
            ...(assigneeId ? [assigneeId] : []),
            ...(input.assigneeIds || [])
        ]

        if (userIdsToCheck.length > 0) {
            const validUserIds = await getWorkspaceUserIds(userIdsToCheck, user.workspaceId)
            if (validUserIds.length !== Array.from(new Set(userIdsToCheck)).length) {
                return { error: 'One or more assignees are not in this workspace' }
            }
        }

        const driveConfig = await getWorkspaceDriveConfig(user.workspaceId)
        let attachmentFolderId = input.attachmentFolderId?.trim() || null
        let attachmentFolderName = input.attachmentFolderName?.trim() || null

        if (driveConfig?.refreshToken && driveConfig.folderId) {
            if (attachmentFolderId && attachmentFolderId !== driveConfig.folderId) {
                const cached = await getDriveFolderCache(user.workspaceId)
                if (!isFolderWithinRoot(cached, driveConfig.folderId, attachmentFolderId)) {
                    return { error: "Selected upload folder is outside the configured Drive root" }
                }
            } else if (attachmentFolderId === driveConfig.folderId && !attachmentFolderName) {
                attachmentFolderName = driveConfig.folderName || attachmentFolderName || "Drive"
            }
        } else {
            attachmentFolderId = null
            attachmentFolderName = null
        }

        const dueDateMs = parseDueDateInput(dueDate)

        const createTaskPayload = {
            title: title.trim(),
            projectId,
            workspaceId: user.workspaceId,
            columnId: columnId ?? null,
            dueDate: dueDateMs,
            description: description?.trim() || undefined,
            assigneeId: assigneeId && assigneeId !== "" ? assigneeId : undefined,
            assigneeIds: input.assigneeIds,
            requireAttachment: input.requireAttachment !== undefined ? input.requireAttachment : false,
            enableProgress: input.enableProgress !== undefined ? input.enableProgress : false,
            progress: input.progress || 0,
            pushId: pushId,
            attachmentFolderId,
            attachmentFolderName,
            createdBy: user.id,
            createdByName: user.name || 'Unknown',
        }

        let result
        let createdWithPrimaryDueDate = dueDateMs !== null

        try {
            result = await createTaskInConvex(createTaskPayload)
        } catch (error) {
            if (dueDateMs === null || !isDateFieldValidatorError(getErrorMessage(error))) {
                throw error
            }
            result = await createTaskInConvex({
                ...createTaskPayload,
                dueDate: undefined,
            })
            createdWithPrimaryDueDate = false
        }

        if (dueDateMs !== null && isDateFieldValidatorError(getResultError(result))) {
            result = await createTaskInConvex({
                ...createTaskPayload,
                dueDate: undefined,
            })
            createdWithPrimaryDueDate = false
        }

        if (!result || 'error' in result) {
            return { error: ((result as Record<string, unknown> | null)?.error as string) || 'Failed to create task' }
        }

        const taskResult = result as {
            success: true
            task: { id: string; columnId: string; assigneeIds: string[] }
            projectName: string
            workspaceDiscordChannelId: string | null
        }

        if (dueDateMs !== null && !createdWithPrimaryDueDate) {
            const dueDateResult = await setTaskDueDateViaMirror(
                taskResult.task.id,
                dueDateMs,
                user.id,
                user.name || 'Unknown'
            )

            if ('error' in dueDateResult) {
                return {
                    error: dueDateResult.error || 'Task was created, but setting the due date failed',
                }
            }
        }

        // Discord: ping only when someone is assigned
        const assignedIds = taskResult.task.assigneeIds ?? []
        const webhookUrl = taskResult.workspaceDiscordChannelId ?? null
        if (assignedIds.length > 0 && webhookUrl) {
            const assignedUsers = await fetchQuery(api.auth.getUserDiscordIds, { userIds: assignedIds })

            if (assignedUsers.length > 0) {
                const mentions = assignedUsers.map((u) => `<@${u.discordId}>`).join(" ")
                if (mentions) {
                    await sendDiscordNotification(
                        "",
                        [{
                            title: "📌 Task Assignment",
                            description: `${mentions}, you have been assigned **${title.trim()}** in project **${taskResult.projectName}**`,
                            color: 0x5865F2,
                            timestamp: new Date().toISOString(),
                        }],
                        webhookUrl
                    )
                }
            }
        }

        revalidatePath(`/dashboard/projects/${projectId}`)
        revalidatePath('/dashboard/my-board')
        const hydratedTask = await getHydratedTask(taskResult.task.id)
        const fallbackTask = {
            id: taskResult.task.id,
            title: title.trim(),
            columnId: taskResult.task.columnId,
            assigneeId: assigneeId || null,
            assignees: (taskResult.task.assigneeIds || []).map((userId: string) => ({ user: { id: userId, name: '' } })),
            description: input.description?.trim() || null,
            dueDate: dueDateMs ? new Date(dueDateMs).toISOString() : null,
            requireAttachment: input.requireAttachment !== undefined ? input.requireAttachment : false,
            enableProgress: input.enableProgress !== undefined ? input.enableProgress : false,
        }

        return {
            success: true,
            task: withDueDateOverride(hydratedTask ?? fallbackTask, dueDateMs, dueDate !== undefined),
        }
    } catch (error) {
        console.error("Create task error:", error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { error: `Failed to create task: ${errorMessage}` }
    }
}

// ─────────────────────────────────────────────────────────────
// updateTaskStatus
// ─────────────────────────────────────────────────────────────

export async function updateTaskStatus(taskId: string, columnId: string, projectId: string) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized', success: false as const, task: null }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace', success: false as const, task: null }
        }

        const resolvedColumnId = await resolveTaskStatusColumnId(columnId, projectId, user.workspaceId)

        const result = await updateTaskStatusInConvex(
            taskId,
            resolvedColumnId,
            user.workspaceId,
            user.role,
            user.id,
            user.name || 'Unknown'
        )

        if (!result) {
            return { error: 'Failed to update task status', success: false as const, task: null }
        }

        if ('error' in result) {
            const r = result as { error: string; message?: string }
            return { error: r.error, message: r.message, success: false as const, task: null }
        }

        const r = result as {
            success: true
            sourceColumnName: string
            targetColumnName: string
            projectId: string
            taskTitle: string
            workspaceDiscordChannelId: string | null
            leadDiscordIds: string[]
            push: { id: string; status: string } | null
        }

        revalidatePath(`/dashboard/projects/${r.projectId}`)
        revalidatePath('/dashboard/my-board')

        // Discord: ping when task moved into Review
        if (r.targetColumnName === 'Review' && r.workspaceDiscordChannelId && r.leadDiscordIds && r.leadDiscordIds.length > 0) {
            const uniqueLeadDiscordIds = Array.from(new Set(r.leadDiscordIds))
            await sendDiscordNotification(
                "",
                [{
                    title: "🔍 Needs Review",
                    description: `${uniqueLeadDiscordIds.map((id) => `<@${id}>`).join(' ')}, **${r.taskTitle}** needs review`,
                    color: 0xFEE75C,
                    timestamp: new Date().toISOString(),
                }],
                r.workspaceDiscordChannelId
            )
        }

        const hydratedTask = await getHydratedTask(taskId)

        return {
            success: true as const,
            task: hydratedTask ?? { id: taskId, title: r.taskTitle, columnId: resolvedColumnId },
        }
    } catch (e) {
        console.error("Update task error:", e)
        const errorMessage = e instanceof Error ? e.message : 'Unknown error'
        return { error: `Failed to move task: ${errorMessage}`, success: false as const, task: null }
    }
}

// ─────────────────────────────────────────────────────────────
// updateTaskDetails
// ─────────────────────────────────────────────────────────────

export async function updateTaskDetails(taskId: string, input: Partial<CreateTaskInput>) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace' }
        }

        const assigneeIdsToCheck = [
            ...(input.assigneeId !== undefined && input.assigneeId !== "" ? [input.assigneeId] : []),
            ...(input.assigneeIds || [])
        ]

        if (assigneeIdsToCheck.length > 0) {
            const validAssigneeIds = await getWorkspaceUserIds(assigneeIdsToCheck, user.workspaceId)
            const uniqueAssigneeIds = Array.from(new Set(assigneeIdsToCheck))
            if (validAssigneeIds.length !== uniqueAssigneeIds.length) {
                return { error: 'One or more assignees are not in this workspace' }
            }
        }

        // Resolve attachment folder details
        let nextAttachmentFolderId: string | null | undefined = undefined
        let nextAttachmentFolderName: string | null | undefined = undefined
        if (input.attachmentFolderId !== undefined) {
            const driveConfig = await getWorkspaceDriveConfig(user.workspaceId)
            const requestedId = input.attachmentFolderId?.trim() || ""
            const requestedName = input.attachmentFolderName?.trim() || null

            if (driveConfig?.refreshToken && driveConfig.folderId) {
                if (!requestedId) {
                    nextAttachmentFolderId = null
                    nextAttachmentFolderName = null
                } else if (requestedId !== driveConfig.folderId) {
                    const cached = await getDriveFolderCache(user.workspaceId)
                    if (!isFolderWithinRoot(cached, driveConfig.folderId, requestedId)) {
                        return { error: "Selected upload folder is outside the configured Drive root" }
                    }
                    nextAttachmentFolderId = requestedId
                    nextAttachmentFolderName = requestedName
                } else {
                    nextAttachmentFolderId = requestedId
                    nextAttachmentFolderName = driveConfig.folderName || requestedName
                }
            } else {
                nextAttachmentFolderId = null
                nextAttachmentFolderName = null
            }
        }

        const dueDateMs = input.dueDate !== undefined
            ? parseDueDateInput(input.dueDate)
            : undefined
        const convexInput = {
            title: input.title,
            description: input.description !== undefined ? (input.description || null) : undefined,
            assigneeId: input.assigneeId !== undefined ? (input.assigneeId && input.assigneeId !== "" ? input.assigneeId : null) : undefined,
            assigneeIds: input.assigneeIds,
            dueDate: dueDateMs,
            requireAttachment: input.requireAttachment,
            enableProgress: input.enableProgress,
            progress: input.progress,
            attachmentFolderId: nextAttachmentFolderId,
            attachmentFolderName: nextAttachmentFolderName,
        }

        let result
        try {
            result = await updateTaskDetailsInConvex(
                taskId,
                user.workspaceId,
                user.role,
                user.id,
                user.name || 'Unknown',
                convexInput
            )
        } catch (error) {
            const errorMessage = getErrorMessage(error)
            if (!isDateFieldValidatorError(errorMessage)) {
                throw error
            }
            result = { error: errorMessage }
        }

        const resultError = getResultError(result)
        const liveValidatorRejectedDueDate =
            isDateFieldValidatorError(resultError)

        if (liveValidatorRejectedDueDate) {
            const existingTask = dueDateMs === null && input.dueDate !== undefined
                ? await getRawTask(taskId)
                : null

            result = await updateTaskDetailsInConvex(
                taskId,
                user.workspaceId,
                user.role,
                user.id,
                user.name || 'Unknown',
                {
                    ...convexInput,
                    dueDate: undefined,
                }
            )

            if (result && !('error' in result) && dueDateMs !== undefined && dueDateMs !== null) {
                const dueDateResult = await setTaskDueDateViaMirror(
                    taskId,
                    dueDateMs,
                    user.id,
                    user.name || 'Unknown'
                )
                if ('error' in dueDateResult) {
                    return { error: dueDateResult.error }
                }
            } else if (
                result
                && !('error' in result)
                && dueDateMs === null
                && existingTask
                && (typeof existingTask.dueDate === 'number' || typeof existingTask.endDate === 'number')
            ) {
                return {
                    error: 'Clearing an existing due date requires the latest Convex functions to be deployed.',
                }
            }
        }

        if (!result || 'error' in result) {
            return { error: ((result as Record<string, unknown> | null)?.error as string) || 'Failed to update task' }
        }

        const r = result as {
            success: true
            task: Record<string, unknown> | null
            newlyAssignedIds: string[]
            discordWebhookUrl: string | null
            projectName: string | null
            taskTitle: string
            projectId: string
        }

        // Discord: ping newly assigned users
        if (r.newlyAssignedIds && r.newlyAssignedIds.length > 0 && r.discordWebhookUrl && r.projectName) {
            const assignedUsers = await fetchQuery(api.auth.getUserDiscordIds, { userIds: r.newlyAssignedIds })
            const mentions = assignedUsers.map((u) => `<@${u.discordId}>`).join(" ")

            if (mentions) {
                await sendDiscordNotification(
                    "",
                    [{
                        title: "📌 Task Assignment",
                        description: `${mentions}, you have been assigned **${r.taskTitle}** in project **${r.projectName}**`,
                        color: 0x5865F2,
                        timestamp: new Date().toISOString(),
                    }],
                    r.discordWebhookUrl
                )
            }
        }

        if (r.projectId) {
            revalidatePath(`/dashboard/projects/${r.projectId}`)
        }
        revalidatePath('/dashboard/my-board')
        const hydratedTask = await getHydratedTask(taskId)

        return {
            success: true,
            task: withDueDateOverride(hydratedTask ?? r.task, dueDateMs, input.dueDate !== undefined),
        }
    } catch (e) {
        console.error("Update details error:", e)
        const errorMessage = e instanceof Error ? e.message : 'Unknown error'
        return { error: `Failed to update task: ${errorMessage}` }
    }
}

// ─────────────────────────────────────────────────────────────
// deleteTask
// ─────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string, projectId: string) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace' }
        }

        const result = await deleteTaskInConvex(
            taskId,
            projectId,
            user.workspaceId,
            user.role,
            user.id,
            user.name || 'Unknown'
        )

        if (!result || 'error' in result) {
            return { error: ((result as Record<string, unknown> | null)?.error as string) || 'Failed to delete task' }
        }

        const { projectId: taskProjectId } = result as { success: true; projectId: string }
        if (taskProjectId) {
            revalidatePath(`/dashboard/projects/${taskProjectId}`)
        }
        return { success: true }
    } catch (e) {
        console.error("Delete task error:", e)
        const errorMessage = e instanceof Error ? e.message : 'Unknown error'
        return { error: `Failed to delete task: ${errorMessage}` }
    }
}

// ─────────────────────────────────────────────────────────────
// acceptReviewTask / denyReviewTask
// ─────────────────────────────────────────────────────────────

export async function acceptReviewTask(taskId: string, columnId: string, projectId: string) {
    // Accept means move to Done
    const result = await updateTaskStatus(taskId, columnId, projectId)
    if (result.success) {
        revalidatePath('/dashboard')
    }
    return result
}

export async function denyReviewTask(taskId: string, columnId: string, projectId: string) {
    // Deny means move back to In Progress
    const result = await updateTaskStatus(taskId, columnId, projectId)
    if (result.success) {
        revalidatePath('/dashboard')
    }
    return result
}

// ─────────────────────────────────────────────────────────────
// updateTaskProgress
// ─────────────────────────────────────────────────────────────

export async function updateTaskProgress(taskId: string, progress: number, projectId: string, forceMoveToReview: boolean = false) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace' }
        }

        const result = await updateTaskProgressInConvex(
            taskId,
            progress,
            user.workspaceId,
            user.role,
            user.id,
            forceMoveToReview
        )

        if (!result || 'error' in result) {
            return { error: ((result as Record<string, unknown> | null)?.error as string) || 'Failed to update progress' }
        }

        return result as { success: true; movedToReview?: boolean }
    } catch (e) {
        console.error("Update progress error:", e)
        return { error: 'Failed to update progress' }
    }
}
