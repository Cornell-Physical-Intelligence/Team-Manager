import { google } from "googleapis"
import { appUrl } from "@/lib/appUrl"
import {
    getWorkspaceDriveConfigFromConvex,
    upsertWorkspaceDriveConfigInConvex,
} from "@/lib/convex/settings"
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/googleDriveTokens"

type DriveConfig = {
    workspaceId: string
    accessToken: string | null
    refreshToken: string | null
    tokenExpiry: number | null
}

type StoredDriveConfig = {
    workspaceId: string
    accessToken?: string | null
    refreshToken?: string | null
    tokenExpiry?: number | null
}

export type DriveFolderNode = {
    id: string
    name: string
    parents: string[]
    modifiedTime?: string | null
}

const FOLDER_CACHE_TTL_MINUTES = 30

function getOAuthRedirectUri() {
    return process.env.GOOGLE_REDIRECT_URI || appUrl("/api/google-drive/callback")
}

export function getGoogleOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = getOAuthRedirectUri()

    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth is not configured")
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

function decodeDriveConfig(config: StoredDriveConfig): DriveConfig {
    return {
        workspaceId: config.workspaceId,
        accessToken: decryptGoogleToken(config.accessToken),
        refreshToken: decryptGoogleToken(config.refreshToken),
        tokenExpiry: config.tokenExpiry ?? null,
    }
}

async function refreshAccessToken(config: DriveConfig) {
    const oauthClient = getGoogleOAuthClient()
    oauthClient.setCredentials({
        refresh_token: config.refreshToken || undefined,
        access_token: config.accessToken || undefined,
        expiry_date: config.tokenExpiry ?? undefined,
    })

    const accessTokenResponse = await oauthClient.getAccessToken()
    const accessToken = accessTokenResponse?.token || oauthClient.credentials.access_token
    const expiryDate = oauthClient.credentials.expiry_date

    if (accessToken && (accessToken !== config.accessToken || (expiryDate && expiryDate !== config.tokenExpiry))) {
        await upsertWorkspaceDriveConfigInConvex({
            workspaceId: config.workspaceId,
            accessToken: encryptGoogleToken(accessToken),
            tokenExpiry: expiryDate ?? null,
        })
    }

    return oauthClient
}

export async function getDriveClientForWorkspace(workspaceId: string) {
    const config = await getWorkspaceDriveConfigFromConvex(workspaceId)

    if (!config?.refreshToken) {
        throw new Error("Google Drive not connected")
    }

    const oauthClient = await refreshAccessToken(decodeDriveConfig(config))

    return google.drive({
        version: "v3",
        auth: oauthClient,
    })
}

export function getGoogleDriveScopes() {
    return ["https://www.googleapis.com/auth/drive"]
}

export async function driveConfigTableExists() {
    return true
}

async function listAllFolders(drive: ReturnType<typeof google.drive>) {
    const seen = new Map<string, DriveFolderNode>()

    const listQuery = async (query: string, corpora: "allDrives" | "user") => {
        let pageToken: string | undefined
        let totalFetched = 0

        do {
            const response = await drive.files.list({
                q: query,
                fields: "nextPageToken, files(id, name, parents, modifiedTime, capabilities(canAddChildren, canEdit))",
                orderBy: "modifiedTime desc",
                pageSize: 500,
                pageToken,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                corpora,
            })

            const batch = response.data.files || []
            batch.forEach((file) => {
                const id = file.id || ""
                const name = file.name || ""
                if (!id || !name) return
                const canEdit = file.capabilities?.canAddChildren || file.capabilities?.canEdit
                if (!canEdit) return
                const parents = (file.parents || []).filter(Boolean) as string[]
                seen.set(id, {
                    id,
                    name,
                    parents,
                    modifiedTime: file.modifiedTime || null,
                })
            })

            totalFetched += batch.length
            pageToken = response.data.nextPageToken || undefined
        } while (pageToken && totalFetched < 5000)
    }

    await listQuery("mimeType = 'application/vnd.google-apps.folder' and trashed = false", "allDrives")
    await listQuery("sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false", "user")

    return Array.from(seen.values())
}

export async function refreshDriveFolderCache(workspaceId: string) {
    const drive = await getDriveClientForWorkspace(workspaceId)
    const folders = await listAllFolders(drive)

    await upsertWorkspaceDriveConfigInConvex({
        workspaceId,
        folderTree: folders,
        folderTreeUpdatedAt: Date.now(),
    })

    return folders
}

export async function getDriveFolderCache(workspaceId: string) {
    const config = await getWorkspaceDriveConfigFromConvex(workspaceId)

    const now = Date.now()
    const updatedAt = config?.folderTreeUpdatedAt || 0
    const isStale = !updatedAt || now - updatedAt > FOLDER_CACHE_TTL_MINUTES * 60 * 1000

    if (!config?.folderTree || isStale) {
        try {
            return await refreshDriveFolderCache(workspaceId)
        } catch (error: unknown) {
            console.error("Drive folder cache refresh failed:", error)
            if (Array.isArray(config?.folderTree)) {
                return config.folderTree as DriveFolderNode[]
            }
            return []
        }
    }

    return config.folderTree as DriveFolderNode[]
}

export function isFolderWithinRoot(nodes: DriveFolderNode[], rootId: string, targetId: string) {
    if (rootId === targetId) return true
    const parentMap = new Map<string, string[]>()
    nodes.forEach((node) => parentMap.set(node.id, node.parents || []))

    const visited = new Set<string>()
    const queue = [targetId]
    while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        const parents = parentMap.get(current) || []
        if (parents.includes(rootId)) return true
        parents.forEach((parent) => {
            if (!visited.has(parent)) queue.push(parent)
        })
    }
    return false
}
