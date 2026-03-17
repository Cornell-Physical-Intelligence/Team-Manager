import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { driveConfigTableExists } from "@/lib/googleDrive"
import { getWorkspaceDriveConfigFromConvex } from "@/lib/convex/settings"

export const runtime = "nodejs"

export async function GET() {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ connected: false, folderId: null, folderName: null }, { status: 200 })
    }

    if (!(await driveConfigTableExists())) {
        return NextResponse.json({ connected: false, folderId: null, folderName: null }, { status: 200 })
    }

    try {
        const config = await getWorkspaceDriveConfigFromConvex(user.workspaceId)

        return NextResponse.json({
            connected: !!config?.refreshToken,
            folderId: config?.folderId || null,
            folderName: config?.folderName || null
        })
    } catch (error) {
        console.error("Failed to load drive config:", error)
        return NextResponse.json({ connected: false, folderId: null, folderName: null }, { status: 200 })
    }
}
