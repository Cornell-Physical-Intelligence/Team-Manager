import type { Doc } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { v } from "convex/values"
import { createLegacyId, stripDoc } from "./lib"

const PROJECT_COLORS = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
] as const

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

type ProjectLead = {
    id: string
    name: string
}

type ProjectMember = {
    userId: string
    user: {
        id: string
        name: string
    }
}

async function getProjectByLegacyId(ctx: Ctx, projectId: string) {
    return ctx.db
        .query("projects")
        .withIndex("by_legacy_id", (q) => q.eq("id", projectId))
        .unique()
}

async function getUserByLegacyId(ctx: Ctx, userId: string) {
    return ctx.db
        .query("users")
        .withIndex("by_legacy_id", (q) => q.eq("id", userId))
        .unique()
}

async function getBoardForProject(ctx: Ctx, projectId: string) {
    const boards = await ctx.db
        .query("boards")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect()

    return boards[0] ?? null
}

async function getColumnsForBoard(ctx: Ctx, boardId: string) {
    const columns = await ctx.db
        .query("columns")
        .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
        .collect()

    return columns
        .slice()
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

async function getProjectLeadAssignments(ctx: Ctx, projectId: string) {
    const assignments = await ctx.db
        .query("projectLeadAssignments")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect()

    return assignments
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

async function getProjectLeadUsers(ctx: Ctx, projectId: string) {
    const assignments = await getProjectLeadAssignments(ctx, projectId)
    const users = await Promise.all(assignments.map((assignment) => getUserByLegacyId(ctx, assignment.userId)))

    return users
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .map((user) => ({
            id: user.id,
            name: user.name,
        }))
}

async function getProjectMembers(ctx: Ctx, projectId: string): Promise<ProjectMember[]> {
    const members = await ctx.db
        .query("projectMembers")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect()

    const users = await Promise.all(members.map((member) => getUserByLegacyId(ctx, member.userId)))

    return members.map((member, index) => ({
        userId: member.userId,
        user: {
            id: users[index]?.id ?? member.userId,
            name: users[index]?.name ?? "Unknown",
        },
    }))
}

async function getPushCount(ctx: Ctx, projectId: string) {
    const pushes = await ctx.db
        .query("pushes")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .collect()

    return pushes.length
}

async function buildProjectListItem(
    ctx: Ctx,
    project: Doc<"projects">,
    includeLead: boolean
) {
    const members = await getProjectMembers(ctx, project.id)
    const leads = includeLead ? await getProjectLeadUsers(ctx, project.id) : []
    const leadIds = leads.map((lead) => lead.id)
    const primaryLeadId = leadIds[0] ?? project.leadId ?? null

    return {
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        color: project.color,
        archivedAt: project.archivedAt ?? null,
        createdAt: project.createdAt,
        leadId: primaryLeadId,
        lead: includeLead ? (leads[0] ?? null) : null,
        leadIds,
        leads,
        members,
    }
}

async function buildProjectDetail(ctx: Ctx, project: Doc<"projects">) {
    const [members, leads, pushCount] = await Promise.all([
        getProjectMembers(ctx, project.id),
        getProjectLeadUsers(ctx, project.id),
        getPushCount(ctx, project.id),
    ])
    const leadIds = leads.map((lead) => lead.id)

    return {
        ...stripDoc(project),
        description: project.description ?? null,
        archivedAt: project.archivedAt ?? null,
        leadId: leadIds[0] ?? project.leadId ?? null,
        lead: leads[0] ?? null,
        leadIds,
        leads,
        members,
        _count: {
            pushes: pushCount,
        },
    }
}

async function deleteRowsByIndex<TableName extends
    | "projectLeadAssignments"
    | "projectMembers"
    | "projectUserOrders"
    | "taskAssignees"
    | "comments"
    | "taskAttachments"
    | "taskChecklistItems"
    | "activityLogs">(
    ctx: MutationCtx,
    table: TableName,
    indexName:
        | "by_projectId"
        | "by_taskId",
    value: string
) {
    const rows = await (ctx.db.query(table as never) as any)
        .withIndex(indexName as any, (q: any) => q.eq(indexName === "by_projectId" ? "projectId" : "taskId", value))
        .collect()

    await Promise.all(rows.map((row: { _id: string }) => ctx.db.delete(row._id as never)))
}

export const listProjects = query({
    args: {
        workspaceId: v.string(),
        userId: v.string(),
        includeArchived: v.boolean(),
        includeLead: v.boolean(),
    },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
            .collect()

        const filteredProjects = projects.filter((project) =>
            args.includeArchived ? true : project.archivedAt === undefined
        )

        const userOrders = await ctx.db
            .query("projectUserOrders")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect()

        const orderMap = new Map(
            userOrders
                .filter((order) => filteredProjects.some((project) => project.id === order.projectId))
                .map((order) => [order.projectId, order.order] as const)
        )

        const sortedProjects = filteredProjects.slice().sort((a, b) => {
            const aOrder = orderMap.get(a.id)
            const bOrder = orderMap.get(b.id)
            const aHas = aOrder !== undefined
            const bHas = bOrder !== undefined

            if (aHas && bHas) return aOrder - bOrder
            if (aHas) return -1
            if (bHas) return 1
            return b.createdAt - a.createdAt
        })

        return Promise.all(
            sortedProjects.map((project) => buildProjectListItem(ctx, project, args.includeLead))
        )
    },
})

export const getProjectDetails = query({
    args: {
        projectId: v.string(),
        workspaceId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) return null
        if (args.workspaceId && project.workspaceId !== args.workspaceId) return null

        return buildProjectDetail(ctx, project)
    },
})

export const getProjectColumns = query({
    args: {
        projectId: v.string(),
        workspaceId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) return null
        if (args.workspaceId && project.workspaceId !== args.workspaceId) return null

        const board = await getBoardForProject(ctx, args.projectId)
        if (!board) return []

        const columns = await getColumnsForBoard(ctx, board.id)
        return columns.map((column) => stripDoc(column))
    },
})

export const createProject = mutation({
    args: {
        projectId: v.string(),
        workspaceId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        color: v.optional(v.string()),
        leadIds: v.array(v.string()),
        memberIds: v.array(v.string()),
        pushes: v.optional(v.array(v.object({
            tempId: v.optional(v.string()),
            name: v.string(),
            startDate: v.number(),
            endDate: v.optional(v.number()),
            color: v.optional(v.string()),
            dependsOn: v.optional(v.string()),
        }))),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const existingProjects = await ctx.db
            .query("projects")
            .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
            .collect()

        const color = args.color
            ?? PROJECT_COLORS[existingProjects.length % PROJECT_COLORS.length]
        const primaryLeadId = args.leadIds[0] ?? null

        await ctx.db.insert("projects", {
            id: args.projectId,
            name: args.name,
            description: args.description,
            color,
            leadId: primaryLeadId ?? undefined,
            workspaceId: args.workspaceId,
            createdAt: args.now,
            updatedAt: args.now,
        })

        for (const userId of args.leadIds) {
            await ctx.db.insert("projectLeadAssignments", {
                id: createLegacyId("project_lead_assignment"),
                projectId: args.projectId,
                userId,
                createdAt: args.now,
            })
        }

        for (const userId of args.memberIds) {
            await ctx.db.insert("projectMembers", {
                id: createLegacyId("project_member"),
                projectId: args.projectId,
                userId,
                createdAt: args.now,
            })
        }

        const boardId = createLegacyId("board")
        await ctx.db.insert("boards", {
            id: boardId,
            name: "Kanban Board",
            projectId: args.projectId,
        })

        const defaultColumns = ["To Do", "In Progress", "Review", "Done"]
        for (const [index, name] of defaultColumns.entries()) {
            await ctx.db.insert("columns", {
                id: createLegacyId("column"),
                boardId,
                name,
                order: index,
            })
        }

        const createdPushes = new Map<string, { docId: string; id: string }>()
        for (const [index, push] of (args.pushes ?? []).entries()) {
            const pushName = push.name.trim()
            if (!pushName) continue

            const pushId = createLegacyId("push")
            const docId = await ctx.db.insert("pushes", {
                id: pushId,
                name: pushName,
                projectId: args.projectId,
                startDate: push.startDate,
                endDate: push.endDate,
                status: "Active",
                color: push.color ?? PUSH_COLORS[index % PUSH_COLORS.length],
                createdAt: args.now,
                updatedAt: args.now,
            })

            if (push.tempId) {
                createdPushes.set(push.tempId, { docId: docId as string, id: pushId })
            }
        }

        for (const push of args.pushes ?? []) {
            if (!push.tempId || !push.dependsOn) continue

            const currentPush = createdPushes.get(push.tempId)
            const dependsOnPush = createdPushes.get(push.dependsOn)
            if (!currentPush || !dependsOnPush) continue

            await ctx.db.patch(currentPush.docId as never, {
                dependsOnId: dependsOnPush.id,
                updatedAt: args.now,
            })
        }

        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) {
            return { error: "Failed to create division" }
        }

        return {
            success: true as const,
            project: await buildProjectDetail(ctx, project),
        }
    },
})

export const updateProject = mutation({
    args: {
        projectId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.union(v.string(), v.null())),
        color: v.optional(v.string()),
        archivedAt: v.optional(v.union(v.number(), v.null())),
        leadIds: v.optional(v.array(v.string())),
        memberIds: v.optional(v.array(v.string())),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) {
            return { error: "Division not found" }
        }

        const patch: Partial<Doc<"projects">> = {
            updatedAt: args.now,
        }

        if (args.name !== undefined) patch.name = args.name
        if (args.description !== undefined) patch.description = args.description ?? undefined
        if (args.color !== undefined) patch.color = args.color
        if (args.archivedAt !== undefined) patch.archivedAt = args.archivedAt ?? undefined
        if (args.leadIds !== undefined) patch.leadId = args.leadIds[0] ?? undefined

        await ctx.db.patch(project._id, patch)

        if (args.leadIds !== undefined) {
            const existingAssignments = await getProjectLeadAssignments(ctx, args.projectId)
            await Promise.all(existingAssignments.map((assignment) => ctx.db.delete(assignment._id)))

            for (const userId of args.leadIds) {
                await ctx.db.insert("projectLeadAssignments", {
                    id: createLegacyId("project_lead_assignment"),
                    projectId: args.projectId,
                    userId,
                    createdAt: args.now,
                })
            }
        }

        if (args.memberIds !== undefined) {
            const existingMembers = await ctx.db
                .query("projectMembers")
                .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
                .collect()

            await Promise.all(existingMembers.map((member) => ctx.db.delete(member._id)))

            for (const userId of args.memberIds) {
                await ctx.db.insert("projectMembers", {
                    id: createLegacyId("project_member"),
                    projectId: args.projectId,
                    userId,
                    createdAt: args.now,
                })
            }
        }

        const updatedProject = await getProjectByLegacyId(ctx, args.projectId)
        if (!updatedProject) {
            return { error: "Division not found" }
        }

        return {
            success: true as const,
            project: await buildProjectDetail(ctx, updatedProject),
        }
    },
})

export const deleteProject = mutation({
    args: {
        projectId: v.string(),
        workspaceId: v.string(),
        deletedBy: v.optional(v.string()),
        deletedByName: v.optional(v.string()),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project || project.workspaceId !== args.workspaceId) {
            return { error: "Division not found" }
        }

        const boards = await ctx.db
            .query("boards")
            .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
            .collect()
        const pushes = await ctx.db
            .query("pushes")
            .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
            .collect()

        const columns = (
            await Promise.all(
                boards.map((board) =>
                    ctx.db
                        .query("columns")
                        .withIndex("by_boardId", (q) => q.eq("boardId", board.id))
                        .collect()
                )
            )
        ).flat()

        const tasksByColumn = (
            await Promise.all(
                columns.map((column) =>
                    ctx.db
                        .query("tasks")
                        .withIndex("by_columnId", (q) => q.eq("columnId", column.id))
                        .collect()
                )
            )
        ).flat()

        const tasksByPush = (
            await Promise.all(
                pushes.map((push) =>
                    ctx.db
                        .query("tasks")
                        .withIndex("by_pushId", (q) => q.eq("pushId", push.id))
                        .collect()
                )
            )
        ).flat()

        const tasks = Array.from(
            new Map(
                [...tasksByColumn, ...tasksByPush].map((task) => [task.id, task] as const)
            ).values()
        )

        for (const task of tasks) {
            const existingDeletion = await ctx.db
                .query("taskDeletions")
                .withIndex("by_taskId", (q) => q.eq("taskId", task.id))
                .collect()

            if (existingDeletion.length === 0) {
                await ctx.db.insert("taskDeletions", {
                    id: createLegacyId("task_deletion"),
                    taskId: task.id,
                    projectId: args.projectId,
                    workspaceId: args.workspaceId,
                    deletedBy: args.deletedBy,
                    deletedByName: args.deletedByName,
                    deletedAt: args.now,
                })
            }

            await deleteRowsByIndex(ctx, "taskAssignees", "by_taskId", task.id)
            await deleteRowsByIndex(ctx, "comments", "by_taskId", task.id)
            await deleteRowsByIndex(ctx, "taskAttachments", "by_taskId", task.id)
            await deleteRowsByIndex(ctx, "taskChecklistItems", "by_taskId", task.id)
            await deleteRowsByIndex(ctx, "activityLogs", "by_taskId", task.id)
            await ctx.db.delete(task._id)
        }

        await Promise.all(columns.map((column) => ctx.db.delete(column._id)))
        await Promise.all(boards.map((board) => ctx.db.delete(board._id)))
        await Promise.all(pushes.map((push) => ctx.db.delete(push._id)))

        await deleteRowsByIndex(ctx, "projectLeadAssignments", "by_projectId", args.projectId)
        await deleteRowsByIndex(ctx, "projectMembers", "by_projectId", args.projectId)
        await deleteRowsByIndex(ctx, "projectUserOrders", "by_projectId", args.projectId)

        await ctx.db.delete(project._id)

        return { success: true as const }
    },
})

export const reorderProjects = mutation({
    args: {
        userId: v.string(),
        workspaceId: v.string(),
        projectIds: v.array(v.string()),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const workspaceProjects = await ctx.db
            .query("projects")
            .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
            .collect()

        const activeWorkspaceProjects = workspaceProjects.filter((project) => project.archivedAt === undefined)
        const activeProjectIds = new Set(activeWorkspaceProjects.map((project) => project.id))

        if (args.projectIds.some((projectId) => !activeProjectIds.has(projectId))) {
            return { error: "One or more divisions are not accessible" }
        }

        const existingOrders = await ctx.db
            .query("projectUserOrders")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect()

        const requestedProjectIds = new Set(args.projectIds)
        const activeWorkspaceProjectIds = new Set(activeWorkspaceProjects.map((project) => project.id))

        await Promise.all(
            existingOrders
                .filter((order) => activeWorkspaceProjectIds.has(order.projectId) && !requestedProjectIds.has(order.projectId))
                .map((order) => ctx.db.delete(order._id))
        )

        const existingOrderMap = new Map(existingOrders.map((order) => [order.projectId, order] as const))

        for (const [order, projectId] of args.projectIds.entries()) {
            const existing = existingOrderMap.get(projectId)
            if (existing) {
                await ctx.db.patch(existing._id, { order })
                continue
            }

            await ctx.db.insert("projectUserOrders", {
                id: createLegacyId("project_user_order"),
                userId: args.userId,
                projectId,
                order,
                createdAt: args.now,
            })
        }

        return { success: true as const }
    },
})
