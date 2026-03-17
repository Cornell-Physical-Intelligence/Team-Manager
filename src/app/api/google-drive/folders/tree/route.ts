import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getWorkspaceDriveConfigFromConvex } from "@/lib/convex/settings"
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

    if (!(await driveConfigTableExists())) {
        return NextResponse.json({ error: "Drive config not initialized" }, { status: 503 })
    }

    const config = await getWorkspaceDriveConfigFromConvex(user.workspaceId)

    const { searchParams } = new URL(request.url)
    const requestedRootId = searchParams.get("rootId")
    const configuredRootId = config?.folderId || ""
    const isLeadership = user.role === "Admin" || user.role === "Team Lead"
    const rootId = isLeadership ? (requestedRootId || configuredRootId) : configuredRootId

    try {
        if (!rootId) {
            return NextResponse.json({ folders: [], rootId: "" })
        }
        const folders = await getDriveFolderCache(user.workspaceId)
        const tree = filterSubtree(folders, rootId)

        return NextResponse.json({ folders: tree, rootId })
    } catch (error) {
        console.error("Google Drive folder cache error:", error)
        return NextResponse.json({ error: "Failed to load folders" }, { status: 500 })
    }
}
