import crypto from "crypto"
import { api, createLegacyId, fetchMutation } from "@/lib/convex/server"

export const SESSION_COOKIE_NAME = "session_token"
export const SESSION_TTL_DAYS = 30
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60

export type SessionWorkspace = {
    id: string
    name: string
    inviteCode: string
    discordChannelId?: string | null
    ownerId: string
    createdAt: number
    updatedAt: number
    _count?: {
        members: number
        projects: number
    }
} | null

export type SessionMembership = {
    id: string
    userId: string
    workspaceId: string
    role: string
    name: string
    joinedAt: number
    workspace: SessionWorkspace
}

export type SessionUser = {
    id: string
    name: string
    email: string
    discordId?: string | null
    avatar?: string | null
    role: string
    workspaceId?: string | null
    skills: string[]
    interests?: string | null
    hasOnboarded: boolean
    createdAt: number
    updatedAt: number
    workspace: SessionWorkspace
    memberships: SessionMembership[]
}

export type SessionRecord = {
    id: string
    userId: string
    tokenHash: string
    expiresAt: number
    createdAt: number
    user: SessionUser
}

function hashSessionToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex")
}

export async function createSession(userId: string) {
    const token = crypto.randomBytes(32).toString("hex")
    const tokenHash = hashSessionToken(token)
    const createdAt = Date.now()
    const expiresAt = new Date(createdAt + SESSION_TTL_SECONDS * 1000)

    await fetchMutation(api.auth.createSession, {
        id: createLegacyId("session"),
        userId,
        tokenHash,
        expiresAt: expiresAt.getTime(),
        createdAt,
    })

    return { token, expiresAt }
}

export async function getSession(token: string): Promise<SessionRecord | null> {
    const tokenHash = hashSessionToken(token)

    const session = await fetchMutation(api.auth.getSessionByTokenHash, {
        tokenHash,
    })

    return session
}

export async function deleteSession(token: string) {
    const tokenHash = hashSessionToken(token)
    await fetchMutation(api.auth.deleteSessionByTokenHash, { tokenHash })
}
