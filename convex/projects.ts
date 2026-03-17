import { query } from "./_generated/server"
import { v } from "convex/values"
import {
    buildProjectPageData,
    buildProjectSyncData,
    getBoardForProject,
    getProjectByLegacyId,
    getProjectTasks,
} from "./boardData"

export const getContext = query({
    args: {
        projectId: v.string(),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) return null

        return {
            id: project.id,
            workspaceId: project.workspaceId ?? null,
        }
    },
})

export const getPageData = query({
    args: {
        projectId: v.string(),
        workspaceId: v.optional(v.string()),
    },
    handler: async (ctx, args) => buildProjectPageData(ctx, args.projectId, args.workspaceId),
})

export const getTasks = query({
    args: {
        projectId: v.string(),
        workspaceId: v.optional(v.string()),
        pushId: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) return null
        if (args.workspaceId && project.workspaceId !== args.workspaceId) return null

        return getProjectTasks(ctx, args.projectId, { pushId: args.pushId })
    },
})

export const getPushTasks = query({
    args: {
        projectId: v.string(),
        workspaceId: v.optional(v.string()),
        pushId: v.string(),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) return null
        if (args.workspaceId && project.workspaceId !== args.workspaceId) return null

        const pageData = await buildProjectPageData(ctx, args.projectId, args.workspaceId)
        if (!pageData?.board) return []

        return pageData.board.columns.map((column) => ({
            ...column,
            tasks: column.tasks.filter((task) => task.push?.id === args.pushId),
        }))
    },
})

export const getBoardDelta = query({
    args: {
        projectId: v.string(),
        workspaceId: v.optional(v.string()),
        since: v.optional(v.string()),
        cursor: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) =>
        buildProjectSyncData(ctx, args.projectId, {
            workspaceId: args.workspaceId,
            since: args.since,
            cursor: args.cursor,
            limit: args.limit,
        }),
})

export const getBoardShell = query({
    args: {
        projectId: v.string(),
        workspaceId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const project = await getProjectByLegacyId(ctx, args.projectId)
        if (!project) return null
        if (args.workspaceId && project.workspaceId !== args.workspaceId) return null

        const board = await getBoardForProject(ctx, args.projectId)
        if (!board) return null

        return {
            id: board.id,
            name: board.name,
        }
    },
})
