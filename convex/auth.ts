import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import {
    getUserByLegacyId,
    hydrateUserForSession,
} from "./lib"

export const createSession = mutation({
    args: {
        id: v.string(),
        userId: v.string(),
        tokenHash: v.string(),
        expiresAt: v.number(),
        createdAt: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("sessions", args)
        return { success: true }
    },
})

export const getSessionByTokenHash = mutation({
    args: {
        tokenHash: v.string(),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
            .unique()

        if (!session) return null

        if (session.expiresAt < Date.now()) {
            await ctx.db.delete(session._id)
            return null
        }

        const user = await getUserByLegacyId(ctx.db, session.userId)
        if (!user) {
            await ctx.db.delete(session._id)
            return null
        }

        return {
            id: session.id,
            userId: session.userId,
            tokenHash: session.tokenHash,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
            user: await hydrateUserForSession(ctx.db, user),
        }
    },
})

export const deleteSessionByTokenHash = mutation({
    args: {
        tokenHash: v.string(),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
            .unique()

        if (session) {
            await ctx.db.delete(session._id)
        }

        return { success: true }
    },
})

export const findUserForDiscordLogin = query({
    args: {
        discordId: v.string(),
        emailCandidates: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const byDiscord = await ctx.db
            .query("users")
            .withIndex("by_discordId", (q) => q.eq("discordId", args.discordId))
            .unique()

        if (byDiscord) {
            return byDiscord
        }

        for (const email of args.emailCandidates) {
            const byEmail = await ctx.db
                .query("users")
                .withIndex("by_email", (q) => q.eq("email", email))
                .unique()

            if (byEmail) {
                return byEmail
            }
        }

        return null
    },
})

export const getUserCount = query({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect()
        return users.length
    },
})

export const getOrCreateDemoUser = mutation({
    args: {
        userId: v.string(),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", "demo@cupi.admin"))
            .unique()

        if (existing) {
            await ctx.db.patch(existing._id, {
                role: "Admin",
                updatedAt: args.now,
            })

            return {
                ...existing,
                role: "Admin" as const,
                updatedAt: args.now,
            }
        }

        const doc = {
            id: args.userId,
            name: "Demo Admin",
            email: "demo@cupi.admin",
            role: "Admin",
            skills: [] as string[],
            hasOnboarded: false,
            createdAt: args.now,
            updatedAt: args.now,
        }

        await ctx.db.insert("users", doc)
        return doc
    },
})

export const updateUserFromDiscord = mutation({
    args: {
        userId: v.string(),
        name: v.optional(v.string()),
        avatar: v.optional(v.string()),
        discordId: v.string(),
        hasOnboarded: v.boolean(),
        updatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByLegacyId(ctx.db, args.userId)
        if (!user) {
            throw new Error("User not found")
        }

        const patch: {
            name?: string
            avatar?: string
            discordId: string
            hasOnboarded: boolean
            updatedAt: number
        } = {
            discordId: args.discordId,
            hasOnboarded: args.hasOnboarded,
            updatedAt: args.updatedAt,
        }

        if (args.name !== undefined) {
            patch.name = args.name
        }

        if (args.avatar !== undefined) {
            patch.avatar = args.avatar
        }

        await ctx.db.patch(user._id, patch)
        return { success: true }
    },
})

export const createUserFromDiscord = mutation({
    args: {
        id: v.string(),
        email: v.string(),
        name: v.string(),
        avatar: v.optional(v.string()),
        discordId: v.string(),
        role: v.string(),
        hasOnboarded: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const doc = {
            ...args,
            skills: [] as string[],
        }

        await ctx.db.insert("users", doc)
        return doc
    },
})

export const updateOnboardingProfile = mutation({
    args: {
        userId: v.string(),
        name: v.string(),
        skills: v.array(v.string()),
        interests: v.optional(v.string()),
        hasOnboarded: v.boolean(),
        updatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByLegacyId(ctx.db, args.userId)
        if (!user) {
            throw new Error("User not found")
        }

        await ctx.db.patch(user._id, {
            name: args.name,
            skills: args.skills,
            interests: args.interests,
            hasOnboarded: args.hasOnboarded,
            updatedAt: args.updatedAt,
        })

        return { success: true }
    },
})

export const updateUserName = mutation({
    args: {
        userId: v.string(),
        name: v.string(),
        updatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await getUserByLegacyId(ctx.db, args.userId)
        if (!user) {
            throw new Error("User not found")
        }

        await ctx.db.patch(user._id, {
            name: args.name,
            updatedAt: args.updatedAt,
        })

        return { success: true }
    },
})

export const getUserDiscordIds = query({
    args: {
        userIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const results: Array<{ id: string; discordId: string }> = []

        for (const userId of args.userIds) {
            const user = await getUserByLegacyId(ctx.db, userId)
            if (user?.discordId) {
                results.push({ id: user.id, discordId: user.discordId })
            }
        }

        return results
    },
})
