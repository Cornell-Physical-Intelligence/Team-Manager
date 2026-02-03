import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { driveConfigTableExists, getDriveClientForWorkspace } from "@/lib/googleDrive"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (user.role !== "Admin" && user.role !== "Team Lead") {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    if (!(await driveConfigTableExists())) {
        return NextResponse.json({ error: "Drive config not initialized" }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get("parentId") || "root"

    if (parentId !== "root" && !/^[a-zA-Z0-9_-]+$/.test(parentId)) {
        return NextResponse.json({ error: "Invalid parentId" }, { status: 400 })
    }

    try {
        const drive = await getDriveClientForWorkspace(user.workspaceId)
        const folders: { id: string; name: string; modifiedTime?: string | null }[] = []
        const seen = new Map<string, { id: string; name: string; modifiedTime?: string | null }>()

        const listFolders = async (query: string) => {
            let pageToken: string | undefined
            let totalFetched = 0

            do {
                const response = await drive.files.list({
                    q: query,
                    fields: "nextPageToken, files(id, name, modifiedTime, capabilities(canAddChildren, canEdit))",
                    orderBy: "modifiedTime desc",
                    pageSize: 200,
                    pageToken,
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true,
                    corpora: "allDrives",
                })

                const batch = (response.data.files || [])
                    .map((file) => ({
                        id: file.id ?? "",
                        name: file.name ?? "",
                        modifiedTime: file.modifiedTime ?? null,
                        canEdit: file.capabilities?.canAddChildren || file.capabilities?.canEdit,
                    }))
                    .filter((file) => file.id && file.name && file.canEdit)

                batch.forEach((file) => {
                    if (!seen.has(file.id)) {
                        seen.set(file.id, { id: file.id, name: file.name, modifiedTime: file.modifiedTime })
                    }
                })

                totalFetched += batch.length
                pageToken = response.data.nextPageToken || undefined
            } while (pageToken && totalFetched < 800)
        }

        if (parentId === "root") {
            await Promise.all([
                listFolders(`'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`),
                listFolders(`sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false`),
            ])
        } else {
            await listFolders(`'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
        }

        folders.push(...seen.values())
        folders.sort((a, b) => {
            const aTime = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0
            const bTime = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0
            return bTime - aTime
        })

        return NextResponse.json({ folders })
    } catch (error) {
        console.error("Google Drive folder list error:", error)
        return NextResponse.json({ error: "Failed to load folders" }, { status: 500 })
    }
}
