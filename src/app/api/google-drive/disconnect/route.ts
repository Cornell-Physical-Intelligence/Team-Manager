import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { deleteWorkspaceDriveConfigInConvex } from "@/lib/convex/settings"
import { driveConfigTableExists } from "@/lib/googleDrive"

export const runtime = "nodejs"

export async function POST() {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (user.role !== "Admin") {
        return NextResponse.json({ error: "Only admins can disconnect" }, { status: 403 })
    }

    if (!(await driveConfigTableExists())) {
        return NextResponse.json({ error: "Drive config not initialized" }, { status: 503 })
    }

    try {
        await deleteWorkspaceDriveConfigInConvex(user.workspaceId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Google Drive disconnect error:", error)
        return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
    }
}
