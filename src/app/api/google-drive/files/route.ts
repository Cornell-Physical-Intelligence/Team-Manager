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
    const folderId = searchParams.get("folderId") || ""

    if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
        return NextResponse.json({ error: "Invalid folderId" }, { status: 400 })
    }

    try {
        const drive = await getDriveClientForWorkspace(user.workspaceId)

        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
            fields: "files(id, name, mimeType, modifiedTime, size, iconLink, webViewLink)",
            orderBy: "modifiedTime desc",
            pageSize: 100,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        })

        const files = (response.data.files || []).map((file) => ({
            id: file.id || "",
            name: file.name || "",
            mimeType: file.mimeType || "application/octet-stream",
            modifiedTime: file.modifiedTime || null,
            size: file.size || null,
            iconLink: file.iconLink || null,
            webViewLink: file.webViewLink || null,
        })).filter((f) => f.id && f.name)

        return NextResponse.json({ files })
    } catch (error) {
        console.error("Google Drive file list error:", error)
        return NextResponse.json({ error: "Failed to load files" }, { status: 500 })
    }
}
