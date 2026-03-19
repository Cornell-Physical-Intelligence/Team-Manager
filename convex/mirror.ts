import { mutation } from "./_generated/server"
import { v } from "convex/values"

const taskShape = {
    id: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    assigneeId: v.optional(v.string()),
    pushId: v.optional(v.string()),
    columnId: v.optional(v.string()),
    subteamId: v.optional(v.string()),
    priority: v.string(),
    requireAttachment: v.boolean(),
    attachmentFolderId: v.optional(v.string()),
    attachmentFolderName: v.optional(v.string()),
    instructionsFileUrl: v.optional(v.string()),
    instructionsFileName: v.optional(v.string()),
    progress: v.number(),
    enableProgress: v.boolean(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
}

const pushShape = {
    id: v.string(),
    name: v.string(),
    projectId: v.string(),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    status: v.string(),
    color: v.string(),
    dependsOnId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
}

const commentShape = {
    id: v.string(),
    content: v.string(),
    taskId: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    replyToId: v.optional(v.string()),
    createdAt: v.number(),
}

const attachmentShape = {
    id: v.string(),
    name: v.string(),
    url: v.string(),
    size: v.number(),
    type: v.string(),
    storageProvider: v.string(),
    externalId: v.optional(v.string()),
    order: v.number(),
    taskId: v.string(),
    uploadedBy: v.string(),
    createdAt: v.number(),
}

const checklistItemShape = {
    id: v.string(),
    taskId: v.string(),
    content: v.string(),
    completed: v.boolean(),
    completedBy: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    order: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
}

export const upsertTask = mutation({
    args: {
        task: v.object(taskShape),
        assigneeIds: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("tasks")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.task.id))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, args.task)
        } else {
            await ctx.db.insert("tasks", args.task)
        }

        if (args.assigneeIds !== undefined) {
            const current = await ctx.db
                .query("taskAssignees")
                .withIndex("by_taskId", (q) => q.eq("taskId", args.task.id))
                .collect()

            for (const record of current) {
                await ctx.db.delete(record._id)
            }

            for (const userId of args.assigneeIds) {
                await ctx.db.insert("taskAssignees", {
                    id: `task_assignee_${args.task.id}_${userId}`,
                    taskId: args.task.id,
                    userId,
                    createdAt: args.task.updatedAt,
                })
            }
        }

        return { success: true }
    },
})

export const deleteTask = mutation({
    args: {
        taskId: v.string(),
    },
    handler: async (ctx, args) => {
        const task = await ctx.db
            .query("tasks")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.taskId))
            .unique()

        if (task) {
            await ctx.db.delete(task._id)
        }

        const taskAssignees = await ctx.db
            .query("taskAssignees")
            .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
            .collect()

        for (const taskAssignee of taskAssignees) {
            await ctx.db.delete(taskAssignee._id)
        }

        return { success: true }
    },
})

export const recordTaskDeletion = mutation({
    args: {
        id: v.string(),
        taskId: v.string(),
        projectId: v.string(),
        workspaceId: v.string(),
        deletedBy: v.optional(v.string()),
        deletedByName: v.optional(v.string()),
        deletedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("taskDeletions")
            .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, args)
        } else {
            await ctx.db.insert("taskDeletions", args)
        }

        return { success: true }
    },
})

export const appendActivityLog = mutation({
    args: {
        id: v.string(),
        taskId: v.optional(v.string()),
        taskTitle: v.optional(v.string()),
        action: v.string(),
        field: v.optional(v.string()),
        oldValue: v.optional(v.string()),
        newValue: v.optional(v.string()),
        changedBy: v.string(),
        changedByName: v.string(),
        details: v.optional(v.string()),
        createdAt: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("activityLogs", args)
        return { success: true }
    },
})

export const upsertPush = mutation({
    args: {
        push: v.object(pushShape),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("pushes")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.push.id))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, args.push)
        } else {
            await ctx.db.insert("pushes", args.push)
        }

        return { success: true }
    },
})

export const deletePush = mutation({
    args: {
        pushId: v.string(),
        clearTaskPushIds: v.boolean(),
        updatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        if (args.clearTaskPushIds) {
            const tasks = await ctx.db
                .query("tasks")
                .withIndex("by_pushId", (q) => q.eq("pushId", args.pushId))
                .collect()

            for (const task of tasks) {
                await ctx.db.patch(task._id, {
                    pushId: undefined,
                    updatedAt: args.updatedAt,
                })
            }
        }

        const push = await ctx.db
            .query("pushes")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.pushId))
            .unique()

        if (push) {
            await ctx.db.delete(push._id)
        }

        return { success: true }
    },
})

export const upsertComment = mutation({
    args: {
        comment: v.object(commentShape),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("comments")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.comment.id))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, args.comment)
        } else {
            await ctx.db.insert("comments", args.comment)
        }

        return { success: true }
    },
})

export const deleteComment = mutation({
    args: {
        commentId: v.string(),
    },
    handler: async (ctx, args) => {
        const comment = await ctx.db
            .query("comments")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.commentId))
            .unique()

        if (comment) {
            await ctx.db.delete(comment._id)
        }

        return { success: true }
    },
})

export const upsertTaskAttachment = mutation({
    args: {
        attachment: v.object(attachmentShape),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("taskAttachments")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.attachment.id))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, args.attachment)
        } else {
            await ctx.db.insert("taskAttachments", args.attachment)
        }

        return { success: true }
    },
})

export const deleteTaskAttachment = mutation({
    args: {
        attachmentId: v.string(),
    },
    handler: async (ctx, args) => {
        const attachment = await ctx.db
            .query("taskAttachments")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.attachmentId))
            .unique()

        if (attachment) {
            await ctx.db.delete(attachment._id)
        }

        return { success: true }
    },
})

export const upsertTaskChecklistItem = mutation({
    args: {
        item: v.object(checklistItemShape),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("taskChecklistItems")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.item.id))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, args.item)
        } else {
            await ctx.db.insert("taskChecklistItems", args.item)
        }

        return { success: true }
    },
})

export const deleteTaskChecklistItem = mutation({
    args: {
        itemId: v.string(),
    },
    handler: async (ctx, args) => {
        const item = await ctx.db
            .query("taskChecklistItems")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.itemId))
            .unique()

        if (item) {
            await ctx.db.delete(item._id)
        }

        return { success: true }
    },
})

export const touchTask = mutation({
    args: {
        taskId: v.string(),
        updatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const task = await ctx.db
            .query("tasks")
            .withIndex("by_legacy_id", (q) => q.eq("id", args.taskId))
            .unique()
        if (task) {
            await ctx.db.patch(task._id, { updatedAt: args.updatedAt })
        }
        return { success: true }
    },
})
