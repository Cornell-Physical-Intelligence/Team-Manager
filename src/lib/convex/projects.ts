import { api, createLegacyId, fetchMutation, fetchQuery } from "@/lib/convex/server"

export type ProjectLeadSummary = {
    id: string
    name: string
}

export type ProjectMemberSummary = {
    userId: string
    user: {
        id: string
        name: string
    }
}

export type ConvexProjectListItem = {
    id: string
    name: string
    description: string | null
    color: string
    archivedAt: number | null
    createdAt: number
    leadId: string | null
    lead: ProjectLeadSummary | null
    leadIds: string[]
    leads: ProjectLeadSummary[]
    members: ProjectMemberSummary[]
}

export type ConvexProjectDetail = {
    id: string
    name: string
    description: string | null
    color: string
    archivedAt: number | null
    leadId: string | null
    workspaceId?: string | null
    createdAt: number
    updatedAt: number
    lead: ProjectLeadSummary | null
    leadIds: string[]
    leads: ProjectLeadSummary[]
    members: ProjectMemberSummary[]
    _count: {
        pushes: number
    }
}

export type ConvexProjectColumn = {
    id: string
    name: string
    boardId: string
    order: number
}

export type ProjectPushInput = {
    tempId?: string
    name: string
    startDate: number
    endDate?: number
    color?: string
    dependsOn?: string
}

export async function listWorkspaceProjects({
    workspaceId,
    userId,
    includeArchived,
    includeLead,
}: {
    workspaceId: string
    userId: string
    includeArchived: boolean
    includeLead: boolean
}) {
    return fetchQuery(api.projectsAdmin.listProjects, {
        workspaceId,
        userId,
        includeArchived,
        includeLead,
    })
}

export async function getWorkspaceProject(projectId: string, workspaceId: string) {
    return fetchQuery(api.projectsAdmin.getProjectDetails, {
        projectId,
        workspaceId,
    })
}

export async function getWorkspaceProjectColumns(projectId: string, workspaceId: string) {
    return fetchQuery(api.projectsAdmin.getProjectColumns, {
        projectId,
        workspaceId,
    })
}

export async function createWorkspaceProject({
    workspaceId,
    name,
    description,
    color,
    leadIds,
    memberIds,
    pushes,
}: {
    workspaceId: string
    name: string
    description?: string
    color?: string
    leadIds: string[]
    memberIds: string[]
    pushes?: ProjectPushInput[]
}) {
    return fetchMutation(api.projectsAdmin.createProject, {
        projectId: createLegacyId("project"),
        workspaceId,
        name,
        description,
        color,
        leadIds,
        memberIds,
        pushes,
        now: Date.now(),
    })
}

export async function updateWorkspaceProject({
    projectId,
    name,
    description,
    color,
    archivedAt,
    leadIds,
    memberIds,
}: {
    projectId: string
    name?: string
    description?: string | null
    color?: string
    archivedAt?: number | null
    leadIds?: string[]
    memberIds?: string[]
}) {
    return fetchMutation(api.projectsAdmin.updateProject, {
        projectId,
        name,
        description,
        color,
        archivedAt,
        leadIds,
        memberIds,
        now: Date.now(),
    })
}

export async function deleteWorkspaceProject({
    projectId,
    workspaceId,
    deletedBy,
    deletedByName,
}: {
    projectId: string
    workspaceId: string
    deletedBy?: string
    deletedByName?: string
}) {
    return fetchMutation(api.projectsAdmin.deleteProject, {
        projectId,
        workspaceId,
        deletedBy,
        deletedByName,
        now: Date.now(),
    })
}

export async function reorderWorkspaceProjects({
    userId,
    workspaceId,
    projectIds,
}: {
    userId: string
    workspaceId: string
    projectIds: string[]
}) {
    return fetchMutation(api.projectsAdmin.reorderProjects, {
        userId,
        workspaceId,
        projectIds,
        now: Date.now(),
    })
}

function toIso(value: number | null | undefined) {
    return typeof value === "number" ? new Date(value).toISOString() : null
}

export function serializeProjectListItem(project: ConvexProjectListItem) {
    return {
        ...project,
        archivedAt: toIso(project.archivedAt),
        createdAt: toIso(project.createdAt),
    }
}

export function serializeProjectDetail(project: ConvexProjectDetail) {
    return {
        ...project,
        archivedAt: toIso(project.archivedAt),
        createdAt: toIso(project.createdAt),
        updatedAt: toIso(project.updatedAt),
    }
}
