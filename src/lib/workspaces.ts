import { getErrorCode } from "@/lib/errors"
import { api, createLegacyId, fetchMutation } from "@/lib/convex/server"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const MAX_RETRIES = 10

export function generateWorkspaceInviteCode(random: () => number = Math.random) {
    let result = ""
    for (let index = 0; index < 6; index += 1) {
        result += ALPHABET.charAt(Math.floor(random() * ALPHABET.length))
    }
    return result
}

export async function createWorkspaceForUser({
    userId,
    userName,
    workspaceName,
}: {
    userId: string
    userName: string
    workspaceName: string
}) {
    const trimmedName = workspaceName.trim()
    if (!trimmedName) {
        throw new Error("Workspace name is required")
    }

    let attempt = 0
    while (attempt < MAX_RETRIES) {
        const inviteCode = generateWorkspaceInviteCode()

        try {
            const result = await fetchMutation(api.workspaces.createWorkspaceForUser, {
                workspaceId: createLegacyId("workspace"),
                membershipId: createLegacyId("workspace_member"),
                userId,
                userName,
                workspaceName: trimmedName,
                inviteCode,
                now: Date.now(),
            })

            if ("error" in result && result.error === "invite_code_taken") {
                attempt += 1
                continue
            }

            return result.workspace
        } catch (error) {
            if (getErrorCode(error) === "P2002") {
                attempt += 1
                continue
            }

            throw error
        }
    }

    throw new Error("Failed to create workspace. Could not generate unique code.")
}
