"use server"

import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { joinWorkspaceByCode } from "@/lib/workspaceInvites"

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
    let result = ''
    for (let i = 0; i < 6; i++) {
        result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
    }
    return result
}

export async function createWorkspace(formData: FormData) {
    const user = await getCurrentUser()
    if (!user) return { error: "Not authenticated" }

    const name = formData.get("name") as string
    if (!name || name.trim().length === 0) return { error: "Workspace name is required" }

    try {
        const userId = user.id

        let workspace = null
        let retries = 0
        const MAX_RETRIES = 10

        while (!workspace && retries < MAX_RETRIES) {
            const code = generateCode()
            try {
                workspace = await prisma.workspace.create({
                    data: {
                        name,
                        inviteCode: code,
                        ownerId: userId
                    }
                })
            } catch (e: any) {
                if (e.code === 'P2002') { // Unique constraint
                    retries++
                    continue
                }
                throw e
            }
        }

        if (!workspace) throw new Error("Failed to create workspace. Could not generate unique code.")

        // Create Member
        await prisma.workspaceMember.create({
            data: {
                userId: userId,
                workspaceId: workspace.id,
                role: 'Admin',
                name: user.name
            }
        })

        // Update user to be Admin of this workspace
        await prisma.user.update({
            where: { id: userId },
            data: {
                workspaceId: workspace.id
            }
        })

        return { success: true, workspaceId: workspace.id }

    } catch (error: any) {
        console.error("Create workspace error:", error)
        return { error: `Failed to create workspace: ${error.message || error}` }
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

    const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } }
    })

    if (!membership) throw new Error("Not a member of this workspace")

    await prisma.user.update({
        where: { id: user.id },
        data: {
            workspaceId
        }
    })
    return { success: true }
}
