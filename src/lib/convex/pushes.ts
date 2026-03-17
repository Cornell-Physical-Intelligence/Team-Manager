import { api, fetchMutation, fetchQuery } from "@/lib/convex/server"

export async function createPush({
    projectId,
    name,
    startDate,
    endDate,
    color,
    dependsOnId,
}: {
    projectId: string
    name: string
    startDate: number
    endDate?: number
    color?: string
    dependsOnId?: string
}) {
    return fetchMutation(api.pushAdmin.createPush, {
        projectId,
        name,
        startDate,
        endDate,
        color,
        dependsOnId,
        now: Date.now(),
    })
}

export async function updatePush({
    pushId,
    name,
    startDate,
    endDate,
    status,
    color,
    dependsOnId,
    workspaceId,
}: {
    pushId: string
    name?: string
    startDate?: number
    endDate?: number | null
    status?: string
    color?: string
    dependsOnId?: string | null
    workspaceId: string
}) {
    return fetchMutation(api.pushAdmin.updatePush, {
        pushId,
        name,
        startDate,
        endDate,
        status,
        color,
        dependsOnId,
        workspaceId,
        now: Date.now(),
    })
}

export async function deletePush({
    pushId,
    projectId,
    workspaceId,
}: {
    pushId: string
    projectId: string
    workspaceId: string
}) {
    return fetchMutation(api.pushAdmin.deletePush, {
        pushId,
        projectId,
        workspaceId,
        now: Date.now(),
    })
}

export async function assignTaskToPush({
    taskId,
    pushId,
    workspaceId,
}: {
    taskId: string
    pushId: string | null
    workspaceId: string
}) {
    return fetchMutation(api.pushAdmin.assignTaskToPush, {
        taskId,
        pushId,
        workspaceId,
        now: Date.now(),
    })
}

export async function listPushes({
    projectId,
    workspaceId,
}: {
    projectId: string
    workspaceId: string
}) {
    return fetchQuery(api.pushAdmin.listPushes, { projectId, workspaceId })
}
