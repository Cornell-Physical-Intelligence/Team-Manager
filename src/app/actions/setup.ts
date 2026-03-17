"use server"

import { getCurrentUser } from "@/lib/auth"
import { joinWorkspaceByCode } from "@/lib/workspaceInvites"
import { api, fetchMutation } from "@/lib/convex/server"
import { getErrorMessage } from "@/lib/errors"
import { createWorkspaceForUser } from "@/lib/workspaces"

export async function createWorkspace(formData: FormData) {
    const user = await getCurrentUser()
    if (!user) return { error: "Not authenticated" }

    const name = formData.get("name") as string
    if (!name || name.trim().length === 0) return { error: "Workspace name is required" }

    try {
        const workspace = await createWorkspaceForUser({
            userId: user.id,
            userName: user.name,
            workspaceName: name,
        })

        return { success: true, workspaceId: workspace.id }

    } catch (error: unknown) {
        console.error("Create workspace error:", error)
        return { error: `Failed to create workspace: ${getErrorMessage(error)}` }
    }
}

export async function joinWorkspace(formData: FormData) {
    const user = await getCurrentUser()
    if (!user) return { error: "Not authenticated" }

    const code = formData.get("code") as string
    if (!code || code.trim().length === 0) return { error: "Invite code is required" }

    try {
        return await joinWorkspaceByCode({
            userId: user.id,
            userName: user.name,
            code,
        })

    } catch (error) {
        console.error("Join workspace error:", error)
        return { error: "Failed to join workspace." }
    }
}

export async function switchWorkspace(workspaceId: string) {
    const user = await getCurrentUser()
    if (!user) throw new Error("Not authenticated")

    const result = await fetchMutation(api.workspaces.switchWorkspace, {
        userId: user.id,
        workspaceId,
        now: Date.now(),
    })

    if (result.error) throw new Error(result.error)

    return { success: true }
}
