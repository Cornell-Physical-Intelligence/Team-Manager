import { api, fetchQuery } from "@/lib/convex/server"

export type TaskContext = {
    id: string
    title: string | null
    projectId: string | null
    workspaceId: string | null
}

export async function getTaskContext(taskId: string): Promise<TaskContext | null> {
    return fetchQuery(api.tasks.getContext, { taskId })
}

export async function getProjectContext(projectId: string) {
    return fetchQuery(api.projects.getContext, { projectId })
}

export async function isUserInWorkspace(userId: string, workspaceId: string) {
    return fetchQuery(api.workspaces.isUserInWorkspace, { userId, workspaceId })
}

export async function getWorkspaceUserIds(userIds: string[], workspaceId: string) {
    const uniqueIds = Array.from(
        new Set(userIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
    )
    if (uniqueIds.length === 0) return []

    return fetchQuery(api.workspaces.getWorkspaceUserIds, { userIds: uniqueIds, workspaceId })
}
