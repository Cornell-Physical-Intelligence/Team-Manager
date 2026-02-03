import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { driveConfigTableExists, getDriveClientForWorkspace } from "@/lib/googleDrive"
import { Readable } from "stream"

export const runtime = "nodejs"

export async function POST(request: Request) {
    const user = await getCurrentUser()
    if (!user || !user.workspaceId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const canUpload = user.role === "Admin" || user.role === "Team Lead"
    if (!canUpload) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    if (!(await driveConfigTableExists())) {
        return NextResponse.json({ error: "Drive config not initialized" }, { status: 503 })
    }

    const config = await prisma.workspaceDriveConfig.findUnique({
        where: { workspaceId: user.workspaceId },
        select: { folderId: true, refreshToken: true },
    })

    if (!config?.refreshToken) {
        return NextResponse.json({ error: "Google Drive is not connected" }, { status: 400 })
    }

    const formData = await request.formData()
    const targetFolderId = formData.get("folderId")?.toString()?.trim() || config.folderId
    const files = formData.getAll("files").filter(Boolean)

    if (!targetFolderId) {
        return NextResponse.json({ error: "No destination folder specified" }, { status: 400 })
    }

    if (files.length === 0) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    try {
        const drive = await getDriveClientForWorkspace(user.workspaceId)
        const uploaded: { id: string; name: string }[] = []

        for (const entry of files) {
            if (!(entry instanceof File)) continue
            const arrayBuffer = await entry.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            const response = await drive.files.create({
                requestBody: {
                    name: entry.name,
                    parents: [targetFolderId],
                },
                media: {
                    mimeType: entry.type || "application/octet-stream",
                    body: Readable.from(buffer),
                },
                fields: "id, name",
                supportsAllDrives: true,
            })

            if (response.data.id) {
                uploaded.push({
                    id: response.data.id,
                    name: response.data.name || entry.name,
                })
            }
        }

        return NextResponse.json({ uploaded })
    } catch (error) {
        console.error("Google Drive upload error:", error)
        return NextResponse.json({ error: "Failed to upload files" }, { status: 500 })
    }
}
