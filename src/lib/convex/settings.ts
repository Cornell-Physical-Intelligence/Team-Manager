import { api, fetchMutation, fetchQuery } from "@/lib/convex/server"

export async function getWorkspaceDriveConfigFromConvex(workspaceId: string) {
    return fetchQuery(api.settings.getWorkspaceDriveConfig, { workspaceId })
}

export async function upsertWorkspaceDriveConfigInConvex(args: {
    workspaceId: string
    now?: number
    provider?: string
    accessToken?: string | null
    refreshToken?: string | null
    tokenExpiry?: number | null
    folderId?: string | null
    folderName?: string | null
    folderTree?: unknown
    folderTreeUpdatedAt?: number | null
    connectedById?: string | null
    connectedByName?: string | null
}) {
    return fetchMutation(api.settings.upsertWorkspaceDriveConfig, {
        workspaceId: args.workspaceId,
        now: args.now ?? Date.now(),
        provider: args.provider,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiry: args.tokenExpiry,
        folderId: args.folderId,
        folderName: args.folderName,
        folderTree: args.folderTree,
        folderTreeUpdatedAt: args.folderTreeUpdatedAt,
        connectedById: args.connectedById,
        connectedByName: args.connectedByName,
    })
}

export async function deleteWorkspaceDriveConfigInConvex(workspaceId: string) {
    return fetchMutation(api.settings.deleteWorkspaceDriveConfig, { workspaceId })
}

export async function getWorkloadConfigFromConvex(workspaceId: string) {
    return fetchQuery(api.settings.getWorkloadConfig, { workspaceId })
}

export async function upsertWorkloadConfigInConvex(workspaceId: string, config: unknown) {
    return fetchMutation(api.settings.upsertWorkloadConfig, {
        workspaceId,
        config,
        now: Date.now(),
    })
}

export async function getSettingsPageDataFromConvex(workspaceId: string) {
    return fetchQuery(api.settings.getPageData, { workspaceId })
}

export async function getUserWorkloadHistoryFromConvex(workspaceId: string, userId: string) {
    return fetchQuery(api.settings.getUserWorkloadHistory, { workspaceId, userId })
}

export async function getProjectActivityFromConvex(workspaceId: string) {
    return fetchQuery(api.settings.getProjectActivity, { workspaceId })
}
