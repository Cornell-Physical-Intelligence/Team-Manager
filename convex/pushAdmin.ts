import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { v } from "convex/values"
import { createLegacyId, stripDoc } from "./lib"

const PUSH_COLORS = [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
    "#84cc16",
] as const

type Ctx = QueryCtx | MutationCtx

async function getPushByLegacyId(ctx: Ctx, pushId: string) {
    return ctx.db
        .query("pushes")
        .withIndex("by_legacy_id", (q) => q.eq("id", pushId))
        .unique()
}

async function getProjectByLegacyId(ctx: Ctx, projectId: string) {
    return ctx.db
        .query("projects")
        .withIndex("by_legacy_id", (q) => q.eq("id", projectId))
        .unique()
}

async function getTaskByLegacyId(ctx: Ctx, taskId: string) {
    return ctx.db
        .query("tasks")
        .withIndex("by_legacy_id", (q) => q.eq("id", taskId))
        .unique()
}

async function getPushWithWorkspace(ctx: Ctx, pushId: string) {
    const push = await getPushByLegacyId(ctx, pushId)
    if (!push) return null
    const project = await getProjectByLegacyId(ctx, push.projectId)
    return project ? { push, workspaceId: project.workspaceId } : null
}

export const createPush = mutation({
    args: {
        projectId: v.string(),
        name: v.string(),
        startDate: v.number(),
        endDate: v.optional(v.number()),
        color: v.optional(v.string()),
        dependsOnId: v.optional(v.string()),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) {
            return { error: "Project not found" }
        }

        if (args.dependsOnId) {
            const dependency = await getPushByLegacyId(ctx, args.dependsOnId)
            if (!dependency || dependency.projectId !== args.projectId) {
                return { error: "Invalid dependency push" }
            }
        }

        const existingPushes = await ctx.db
            .query("pushes")
            .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
            .collect()

        const existingCount = existingPushes.length
        const color = args.color ?? PUSH_COLORS[existingCount % PUSH_COLORS.length]
        const pushId = createLegacyId("push")

        await ctx.db.insert("pushes", {
            id: pushId,
            name: args.name,
            projectId: args.projectId,
            startDate: args.startDate,
            endDate: args.endDate,
            status: "Active",
            color,
            dependsOnId: args.dependsOnId,
            createdAt: args.now,
            updatedAt: args.now,
        })

        return {
            success: true as const,
            push: {
                id: pushId,
                name: args.name,
                projectId: args.projectId,
                startDate: args.startDate,
                endDate: args.endDate ?? null,
                status: "Active",
                color,
                dependsOnId: args.dependsOnId ?? null,
            },
        }
    },
})

export const updatePush = mutation({
    args: {
        pushId: v.string(),
        name: v.optional(v.string()),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.union(v.number(), v.null())),
        status: v.optional(v.string()),
        color: v.optional(v.string()),
        dependsOnId: v.optional(v.union(v.string(), v.null())),
        workspaceId: v.string(),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const result = await getPushWithWorkspace(ctx, args.pushId)
        if (!result || result.workspaceId !== args.workspaceId) {
            return { error: "Push not found" }
        }

        const { push } = result

        if (args.dependsOnId !== undefined && args.dependsOnId !== null) {
            const dependency = await getPushByLegacyId(ctx, args.dependsOnId)
            if (!dependency || dependency.projectId !== push.projectId) {
                return { error: "Invalid dependency push" }
            }
        }

        const patch: Record<string, unknown> = { updatedAt: args.now }
        if (args.name !== undefined) patch.name = args.name
        if (args.startDate !== undefined) patch.startDate = args.startDate
        if (args.endDate !== undefined) patch.endDate = args.endDate ?? undefined
        if (args.status !== undefined) patch.status = args.status
        if (args.color !== undefined) patch.color = args.color
        if (args.dependsOnId !== undefined) patch.dependsOnId = args.dependsOnId ?? undefined

        await ctx.db.patch(push._id, patch as never)

        return { success: true as const }
    },
})

export const deletePush = mutation({
    args: {
        pushId: v.string(),
        projectId: v.string(),
        workspaceId: v.string(),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const result = await getPushWithWorkspace(ctx, args.pushId)
        if (!result || result.workspaceId !== args.workspaceId || result.push.projectId !== args.projectId) {
            return { error: "Push not found" }
        }

        const { push } = result

        // Clear pushId from all tasks referencing this push
        const tasks = await ctx.db
            .query("tasks")
            .withIndex("by_pushId", (q) => q.eq("pushId", args.pushId))
            .collect()

        await Promise.all(
            tasks.map((task) =>
                ctx.db.patch(task._id, { pushId: undefined, updatedAt: args.now })
            )
        )

        await ctx.db.delete(push._id)

        return { success: true as const }
    },
})

export const assignTaskToPush = mutation({
    args: {
        taskId: v.string(),
        pushId: v.union(v.string(), v.null()),
        workspaceId: v.string(),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const task = await getTaskByLegacyId(ctx, args.taskId)
        if (!task) {
            return { error: "Task not found" }
        }

        // Validate task belongs to workspace via column → board → project → workspace
        if (task.columnId) {
            const column = await ctx.db
                .query("columns")
                .withIndex("by_legacy_id", (q) => q.eq("id", task.columnId!))
                .unique()

            if (column) {
                const board = await ctx.db
                    .query("boards")
                    .withIndex("by_legacy_id", (q) => q.eq("id", column.boardId))
                    .unique()

                if (board) {
                    const project = await getProjectByLegacyId(ctx, board.projectId)
                    if (!project || project.workspaceId !== args.workspaceId) {
                        return { error: "Task not found" }
                    }

                    if (args.pushId) {
                        const push = await getPushByLegacyId(ctx, args.pushId)
                        if (!push || push.projectId !== board.projectId) {
                            return { error: "Push does not belong to this task project" }
                        }
                    }
                }
            }
        } else if (task.pushId) {
            // Task has a push but no column — validate via the existing push
            const existingPush = await getPushByLegacyId(ctx, task.pushId)
            if (existingPush) {
                const project = await getProjectByLegacyId(ctx, existingPush.projectId)
                if (!project || project.workspaceId !== args.workspaceId) {
                    return { error: "Task not found" }
                }
            }
        }

        const updatedAt = args.now
        await ctx.db.patch(task._id, {
            pushId: args.pushId ?? undefined,
            updatedAt,
        })

        return {
            success: true as const,
            task: {
                id: task.id,
                pushId: args.pushId,
                updatedAt,
            },
        }
    },
})

export const listPushes = query({
    args: {
        projectId: v.string(),
        workspaceId: v.string(),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project || project.workspaceId !== args.workspaceId) {
            return []
        }

        const pushes = await ctx.db
            .query("pushes")
            .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
            .collect()

        const result = await Promise.all(
            pushes.map(async (push) => {
                const tasks = await ctx.db
                    .query("tasks")
                    .withIndex("by_pushId", (q) => q.eq("pushId", push.id))
                    .collect()

                // Count done tasks by checking column name
                let completedCount = 0
                if (tasks.length > 0) {
                    const columnIds = Array.from(new Set(tasks.map((t) => t.columnId).filter(Boolean))) as string[]
                    const columns = await Promise.all(
                        columnIds.map((colId) =>
                            ctx.db
                                .query("columns")
                                .withIndex("by_legacy_id", (q) => q.eq("id", colId))
                                .unique()
                        )
                    )
                    const doneColumnIds = new Set(
                        columns
                            .filter((col): col is NonNullable<typeof col> => col !== null && col.name === "Done")
                            .map((col) => col.id)
                    )
                    completedCount = tasks.filter((t) => t.columnId && doneColumnIds.has(t.columnId)).length
                }

                return {
                    ...stripDoc(push),
                    endDate: push.endDate ?? null,
                    dependsOnId: push.dependsOnId ?? null,
                    taskCount: tasks.length,
                    completedCount,
                }
            })
        )

        return result.slice().sort((a, b) => a.startDate - b.startDate)
    },
})
