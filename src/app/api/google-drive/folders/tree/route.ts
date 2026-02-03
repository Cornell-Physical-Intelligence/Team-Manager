import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { driveConfigTableExists, getDriveFolderCache } from "@/lib/googleDrive"

export const runtime = "nodejs"

function buildChildMap(nodes: { id: string; parents: string[] }[]) {
    const map = new Map<string, string[]>()
    nodes.forEach((node) => {
        node.parents?.forEach((parentId) => {
            if (!map.has(parentId)) map.set(parentId, [])
            map.get(parentId)!.push(node.id)
        })
    })
    return map
}

function filterSubtree(nodes: { id: string; parents: string[] }[], rootId: string) {
    const childMap = buildChildMap(nodes)
    const queue = [rootId]
    const seen = new Set<string>([rootId])

    while (queue.length > 0) {
        const current = queue.shift()!
        const children = childMap.get(current) || []
        children.forEach((childId) => {
            if (!seen.has(childId)) {
                seen.add(childId)
                queue.push(childId)
            }
        })
    }

    return nodes.filter((node) => seen.has(node.id))
}

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

    const config = await prisma.workspaceDriveConfig.findUnique({
        where: { workspaceId: user.workspaceId },
        select: { folderId: true },
    })

    const { searchParams } = new URL(request.url)
    const rootId = searchParams.get("rootId") || config?.folderId || ""

    try {
        const folders = await getDriveFolderCache(user.workspaceId)
        const tree = rootId ? filterSubtree(folders, rootId) : folders

        return NextResponse.json({ folders: tree, rootId })
    } catch (error) {
        console.error("Google Drive folder cache error:", error)
        return NextResponse.json({ error: "Failed to load folders" }, { status: 500 })
    }
}

