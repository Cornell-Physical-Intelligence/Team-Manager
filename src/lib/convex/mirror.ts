import { api, createLegacyId, fetchMutation } from "@/lib/convex/server"

type Timestampable = Date | string | number | null | undefined

function toTimestamp(value: Timestampable) {
    if (value === null || value === undefined) return undefined
    if (typeof value === "number") return value
    if (value instanceof Date) return value.getTime()
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime()
}

type TaskSnapshot = {
    id: string
    title: string
    description?: string | null
    status?: string | null
    assigneeId?: string | null
    pushId?: string | null
    columnId?: string | null
    subteamId?: string | null
    priority?: string | null
    requireAttachment?: boolean | null
    attachmentFolderId?: string | null
    attachmentFolderName?: string | null
    instructionsFileUrl?: string | null
    instructionsFileName?: string | null
    progress?: number | null
    enableProgress?: boolean | null
    startDate?: Timestampable
    endDate?: Timestampable
    dueDate?: Timestampable
    submittedAt?: Timestampable
    approvedAt?: Timestampable
    createdAt?: Timestampable
    updatedAt?: Timestampable
    assignees?: { userId: string }[] | { user: { id: string } }[]
}

type PushSnapshot = {
    id: string
    name: string
    projectId: string
    startDate: Timestampable
    endDate?: Timestampable
    status?: string | null
    color?: string | null
    dependsOnId?: string | null
    createdAt?: Timestampable
    updatedAt?: Timestampable
}

export async function syncTaskToConvex(
    task: TaskSnapshot,
    explicitAssigneeIds?: string[],
    options?: { updatedAt?: Timestampable }
) {
    const assigneeIds = explicitAssigneeIds ?? task.assignees?.map((assignee) => {
        if ("userId" in assignee) return assignee.userId
        return assignee.user.id
    }) ?? []

    await fetchMutation(api.mirror.upsertTask, {
        task: {
            id: task.id,
            title: task.title,
            description: task.description || undefined,
            status: task.status || "Todo",
            assigneeId: task.assigneeId || undefined,
            pushId: task.pushId || undefined,
            columnId: task.columnId || undefined,
            subteamId: task.subteamId || undefined,
            priority: task.priority || "Medium",
            requireAttachment: task.requireAttachment ?? true,
            attachmentFolderId: task.attachmentFolderId || undefined,
            attachmentFolderName: task.attachmentFolderName || undefined,
            instructionsFileUrl: task.instructionsFileUrl || undefined,
            instructionsFileName: task.instructionsFileName || undefined,
            progress: task.progress ?? 0,
            enableProgress: task.enableProgress ?? false,
            startDate: toTimestamp(task.startDate),
            endDate: toTimestamp(task.endDate),
            dueDate: toTimestamp(task.dueDate),
            submittedAt: toTimestamp(task.submittedAt),
            approvedAt: toTimestamp(task.approvedAt),
            createdAt: toTimestamp(task.createdAt) ?? Date.now(),
            updatedAt: toTimestamp(options?.updatedAt) ?? toTimestamp(task.updatedAt) ?? Date.now(),
        },
        assigneeIds,
    })
}

export async function deleteTaskFromConvex(taskId: string) {
    await fetchMutation(api.mirror.deleteTask, { taskId })
}

export async function recordTaskDeletionInConvex(args: {
    taskId: string
    projectId: string
    workspaceId: string
    deletedBy?: string | null
    deletedByName?: string | null
    deletedAt?: Timestampable
}) {
    await fetchMutation(api.mirror.recordTaskDeletion, {
        id: createLegacyId("task_deletion"),
        taskId: args.taskId,
        projectId: args.projectId,
        workspaceId: args.workspaceId,
        deletedBy: args.deletedBy || undefined,
        deletedByName: args.deletedByName || undefined,
        deletedAt: toTimestamp(args.deletedAt) ?? Date.now(),
    })
}

export async function appendActivityLogToConvex(args: {
    taskId?: string | null
    taskTitle?: string | null
    action: string
    field?: string | null
    oldValue?: string | null
    newValue?: string | null
    changedBy: string
    changedByName: string
    details?: string | null
    createdAt?: Timestampable
}) {
    await fetchMutation(api.mirror.appendActivityLog, {
        id: createLegacyId("activity_log"),
        taskId: args.taskId || undefined,
        taskTitle: args.taskTitle || undefined,
        action: args.action,
        field: args.field || undefined,
        oldValue: args.oldValue || undefined,
        newValue: args.newValue || undefined,
        changedBy: args.changedBy,
        changedByName: args.changedByName,
        details: args.details || undefined,
        createdAt: toTimestamp(args.createdAt) ?? Date.now(),
    })
}

export async function syncPushToConvex(push: PushSnapshot) {
    await fetchMutation(api.mirror.upsertPush, {
        push: {
            id: push.id,
            name: push.name,
            projectId: push.projectId,
            startDate: toTimestamp(push.startDate) ?? Date.now(),
            endDate: toTimestamp(push.endDate),
            status: push.status || "Active",
            color: push.color || "#3b82f6",
            dependsOnId: push.dependsOnId || undefined,
            createdAt: toTimestamp(push.createdAt) ?? Date.now(),
            updatedAt: toTimestamp(push.updatedAt) ?? Date.now(),
        },
    })
}

export async function deletePushFromConvex(pushId: string, clearTaskPushIds = true) {
    await fetchMutation(api.mirror.deletePush, {
        pushId,
        clearTaskPushIds,
        updatedAt: Date.now(),
    })
}

type CommentSnapshot = {
    id: string
    content: string
    taskId: string
    authorId: string
    authorName: string
    replyToId?: string | null
    createdAt?: Timestampable
}

export async function upsertCommentToConvex(comment: CommentSnapshot) {
    await fetchMutation(api.mirror.upsertComment, {
        comment: {
            id: comment.id,
            content: comment.content,
            taskId: comment.taskId,
            authorId: comment.authorId,
            authorName: comment.authorName,
            replyToId: comment.replyToId || undefined,
            createdAt: toTimestamp(comment.createdAt) ?? Date.now(),
        },
    })
}

export async function deleteCommentFromConvex(commentId: string) {
    await fetchMutation(api.mirror.deleteComment, { commentId })
}

type TaskAttachmentSnapshot = {
    id: string
    name: string
    url: string
    size: number
    type: string
    storageProvider: string
    externalId?: string | null
    order: number
    taskId: string
    uploadedBy: string
    createdAt?: Timestampable
}

export async function upsertTaskAttachmentToConvex(attachment: TaskAttachmentSnapshot) {
    await fetchMutation(api.mirror.upsertTaskAttachment, {
        attachment: {
            id: attachment.id,
            name: attachment.name,
            url: attachment.url,
            size: attachment.size,
            type: attachment.type,
            storageProvider: attachment.storageProvider,
            externalId: attachment.externalId || undefined,
            order: attachment.order,
            taskId: attachment.taskId,
            uploadedBy: attachment.uploadedBy,
            createdAt: toTimestamp(attachment.createdAt) ?? Date.now(),
        },
    })
}

export async function deleteTaskAttachmentFromConvex(attachmentId: string) {
    await fetchMutation(api.mirror.deleteTaskAttachment, { attachmentId })
}

type ChecklistItemSnapshot = {
    id: string
    taskId: string
    content: string
    completed: boolean
    completedBy?: string | null
    completedAt?: Timestampable
    order: number
    createdBy: string
    createdAt?: Timestampable
    updatedAt?: Timestampable
}

export async function upsertChecklistItemToConvex(item: ChecklistItemSnapshot) {
    await fetchMutation(api.mirror.upsertTaskChecklistItem, {
        item: {
            id: item.id,
            taskId: item.taskId,
            content: item.content,
            completed: item.completed,
            completedBy: item.completedBy || undefined,
            completedAt: toTimestamp(item.completedAt),
            order: item.order,
            createdBy: item.createdBy,
            createdAt: toTimestamp(item.createdAt) ?? Date.now(),
            updatedAt: toTimestamp(item.updatedAt) ?? Date.now(),
        },
    })
}

export async function deleteChecklistItemFromConvex(itemId: string) {
    await fetchMutation(api.mirror.deleteTaskChecklistItem, { itemId })
}

type HelpRequestSnapshot = {
    id: string
    taskId: string
    requestedBy: string
    requestedByName: string
    message?: string | null
    status: string
    resolvedBy?: string | null
    resolvedByName?: string | null
    resolvedAt?: Timestampable
    createdAt?: Timestampable
    updatedAt?: Timestampable
}

export async function upsertHelpRequestToConvex(helpRequest: HelpRequestSnapshot) {
    await fetchMutation(api.mirror.upsertHelpRequest, {
        helpRequest: {
            id: helpRequest.id,
            taskId: helpRequest.taskId,
            requestedBy: helpRequest.requestedBy,
            requestedByName: helpRequest.requestedByName,
            message: helpRequest.message || undefined,
            status: helpRequest.status,
            resolvedBy: helpRequest.resolvedBy || undefined,
            resolvedByName: helpRequest.resolvedByName || undefined,
            resolvedAt: toTimestamp(helpRequest.resolvedAt),
            createdAt: toTimestamp(helpRequest.createdAt) ?? Date.now(),
            updatedAt: toTimestamp(helpRequest.updatedAt) ?? Date.now(),
        },
    })
}

export async function deleteHelpRequestFromConvex(helpRequestId: string) {
    await fetchMutation(api.mirror.deleteHelpRequest, { helpRequestId })
}

export async function touchTaskInConvex(taskId: string, updatedAt?: number) {
    await fetchMutation(api.mirror.touchTask, {
        taskId,
        updatedAt: updatedAt ?? Date.now(),
    })
}
