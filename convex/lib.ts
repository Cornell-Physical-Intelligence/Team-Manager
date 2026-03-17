import type { Doc } from "./_generated/dataModel"
import type { DatabaseReader, DatabaseWriter } from "./_generated/server"

type Db = DatabaseReader | DatabaseWriter

export function now() {
    return Date.now()
}

export function createLegacyId(prefix: string) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
    }

    return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function generateWorkspaceInviteCode(random: () => number = Math.random) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let result = ""

    for (let index = 0; index < 6; index += 1) {
        result += alphabet.charAt(Math.floor(random() * alphabet.length))
    }

    return result
}

export function stripDoc<T extends { _id: unknown; _creationTime: unknown }>(doc: T) {
    const { _id, _creationTime, ...rest } = doc
    void _id
    void _creationTime
    return rest
}

export async function getUserByLegacyId(db: Db, userId: string) {
    return db
        .query("users")
        .withIndex("by_legacy_id", (q) => q.eq("id", userId))
        .unique()
}

export async function getWorkspaceByLegacyId(db: Db, workspaceId: string) {
    return db
        .query("workspaces")
        .withIndex("by_legacy_id", (q) => q.eq("id", workspaceId))
        .unique()
}

export async function getInviteByToken(db: Db, token: string) {
    return db
        .query("invites")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique()
}

export async function getWorkspaceByInviteCode(db: Db, inviteCode: string) {
    return db
        .query("workspaces")
        .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
        .unique()
}

export async function getWorkspaceMemberByUserAndWorkspace(
    db: Db,
    userId: string,
    workspaceId: string
) {
    return db
        .query("workspaceMembers")
        .withIndex("by_userId_workspaceId", (q) =>
            q.eq("userId", userId).eq("workspaceId", workspaceId)
        )
        .unique()
}

export async function getWorkspaceCounts(db: Db, workspaceId: string) {
    const [members, projects] = await Promise.all([
        db
            .query("workspaceMembers")
            .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
            .collect(),
        db
            .query("projects")
            .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
            .collect(),
    ])

    return {
        members: members.length,
        projects: projects.length,
    }
}

export async function serializeWorkspace(
    db: Db,
    workspace: Doc<"workspaces"> | null | undefined,
    includeCounts = false
) {
    if (!workspace) return null

    const base = stripDoc(workspace)

    if (!includeCounts) {
        return base
    }

    const counts = await getWorkspaceCounts(db, workspace.id)

    return {
        ...base,
        _count: counts,
    }
}

export async function hydrateMembership(db: Db, membership: Doc<"workspaceMembers">) {
    const workspace = await getWorkspaceByLegacyId(db, membership.workspaceId)

    return {
        ...stripDoc(membership),
        workspace: await serializeWorkspace(db, workspace, true),
    }
}

export async function hydrateMembershipsForUser(db: Db, userId: string) {
    const memberships = await db
        .query("workspaceMembers")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()

    return Promise.all(memberships.map((membership) => hydrateMembership(db, membership)))
}

export async function hydrateUserForSession(db: Db, user: Doc<"users">) {
    const workspace = user.workspaceId
        ? await getWorkspaceByLegacyId(db, user.workspaceId)
        : null

    return {
        ...stripDoc(user),
        workspace: await serializeWorkspace(db, workspace, false),
        memberships: await hydrateMembershipsForUser(db, user.id),
    }
}
