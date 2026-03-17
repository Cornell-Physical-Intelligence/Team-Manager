'use server'

import { getCurrentUser } from "@/lib/auth"
import { api, fetchMutation, fetchQuery } from "@/lib/convex/server"

export async function deleteWorkspace(workspaceId: string, confirmName: string) {
    const user = await getCurrentUser()
    if (!user) return { error: "Not authenticated" }

    try {
        const workspace = await fetchQuery(api.admin.getWorkspace, {
            workspaceId,
        })

        if (!workspace) return { error: "Workspace not found" }

        // Security checks
        if (workspace.ownerId !== user.id) {
            const membership = user.memberships.find((entry) => entry.workspaceId === workspaceId)

            if (!membership || membership.role !== 'Admin') {
                return { error: "You do not have permission to delete this workspace (Owner or Admin required)" }
            }
            // Even admins shouldn't delete if not owner? "Workspace Admin... wipes it".
            // I'll allow Admin.
        }

        if (workspace.name !== confirmName) {
            return { error: "Workspace name confirmation incorrect" }
        }

        const result = await fetchMutation(api.admin.deleteWorkspace, {
            workspaceId,
        })
        if ('error' in result) {
            return { error: "Workspace not found" }
        }

        return { success: true }

    } catch (error) {
        console.error("Delete Workspace Error:", error)
        return { error: "An unexpected error occurred while deleting the workspace" }
    }
}
