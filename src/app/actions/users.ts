'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from '@/lib/auth'

export async function updateUserRole(userId: string, newRole: string) {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { error: 'Unauthorized: Not authenticated' }
    }

    if (currentUser.role !== 'Admin' && currentUser.role !== 'Team Lead') {
        return { error: 'Unauthorized: Only Admins and Team Leads can change roles' }
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, workspaceId: true }
    })

    if (!targetUser) {
        return { error: 'User not found' }
    }

    // PROTECT ADMINS: Only Admins can change role of other Admins
    if (targetUser.role === 'Admin' && currentUser.role !== 'Admin') {
        return { error: 'Unauthorized: Only Admins can modify other Admins' }
    }

    // PROTECT ADMIN ROLE PROMOTION: Only Admins can promote to Admin
    if (newRole === 'Admin' && currentUser.role !== 'Admin') {
        return { error: 'Unauthorized: Only Admins can promote users to Admin' }
    }

    // Check if admin is trying to demote themselves
    if (currentUser.id === userId && newRole !== 'Admin') {
        // Count how many admins exist in the workspace
        const adminCount = await prisma.user.count({
            where: {
                role: 'Admin',
                workspaceId: currentUser.workspaceId
            }
        })

        // If this is the only admin, prevent self-demotion
        if (adminCount <= 1) {
            return {
                error: 'Cannot remove your admin role: You are the only admin. Please assign another admin first.',
                requiresAdminAssignment: true
            }
        }
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { role: newRole }
        })
        revalidatePath('/dashboard/members')
        revalidatePath('/dashboard/projects')
        return { success: true }
    } catch (error) {
        console.error("Failed to update role", error)
        return { error: 'Failed to update role' }
    }
}

export async function updateUserProjects(userId: string, projectIds: string[]) {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { error: 'Unauthorized: Not authenticated' }
    }

    // Allow Team Leads to assign projects too
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Team Lead') {
        return { error: 'Unauthorized: Only Admins and Team Leads can change project assignments' }
    }

    try {
        // Use transaction to ensure atomic operation
        await prisma.$transaction(async (tx) => {
            // Delete existing project memberships
            await tx.projectMember.deleteMany({
                where: { userId }
            })

            // Create new project memberships
            if (projectIds.length > 0) {
                await tx.projectMember.createMany({
                    data: projectIds.map(projectId => ({
                        userId,
                        projectId
                    }))
                })
            }
        })

        revalidatePath('/dashboard/members')
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error("Failed to update project assignments", error)
        return { error: 'Failed to update project assignments' }
    }
}

export async function removeUserFromWorkspace(userId: string) {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
        return { error: 'Unauthorized: Not authenticated' }
    }

    if (currentUser.role !== 'Admin' && currentUser.role !== 'Team Lead') {
        return { error: 'Unauthorized: Only Admins and Team Leads can remove members' }
    }

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, workspaceId: true }
    })

    if (!targetUser) {
        return { error: 'User not found' }
    }

    // PROTECT ADMINS: Only Admins can remove other Admins
    if (targetUser.role === 'Admin' && currentUser.role !== 'Admin') {
        return { error: 'Unauthorized: Only Admins can remove other Admins' }
    }

    // Check if user is removing themselves
    if (currentUser.id === userId) {
        // Count how many admins exist in the workspace
        if (currentUser.role === 'Admin') {
            const adminCount = await prisma.user.count({
                where: {
                    role: 'Admin',
                    workspaceId: currentUser.workspaceId
                }
            })

            // If this is the only admin, prevent leaving/removal
            if (adminCount <= 1) {
                return {
                    error: 'Cannot leave workspace: You are the only admin. Please assign another admin first.',
                    requiresAdminAssignment: true
                }
            }
        }
    }

    try {
        // Use transaction to ensure atomic operation
        if (currentUser.workspaceId) {
            await prisma.$transaction(async (tx) => {
                console.log(`[Users] User ${currentUser.id} is removing user ${userId} from workspace ${currentUser.workspaceId}`)

                // Remove from WorkspaceMember
                await tx.workspaceMember.delete({
                    where: {
                        userId_workspaceId: {
                            userId: userId,
                            workspaceId: currentUser.workspaceId!
                        }
                    }
                })

                // Also clear user's workspaceId and role if this was their main workspace
                if (targetUser?.workspaceId === currentUser.workspaceId) {
                    console.log(`[Users] Resetting user ${userId} role to 'Member' because they were removed from their main workspace.`)
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            workspaceId: null,
                            role: 'Member' // Reset role to Member default
                        }
                    })
                }
            })
        }

        revalidatePath('/dashboard/members')
        revalidatePath('/dashboard/projects')
        return { success: true }
    } catch (error) {
        console.error("Failed to remove user from workspace", error)
        return { error: 'Failed to remove user from workspace' }
    }
}
