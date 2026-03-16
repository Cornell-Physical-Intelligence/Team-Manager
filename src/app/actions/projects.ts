'use server'

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth'
import { getProjectContext, getWorkspaceUserIds } from '@/lib/access'
import { getPrimaryProjectLeadId, mergeProjectMemberIds } from '@/lib/project-leads'

export async function createProject(formData: FormData) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace' }
        }

        // RBAC Check
        if (user.role !== 'Admin') {
            console.error('[createProject] Unauthorized user:', user.role)
            return { error: 'Unauthorized: Only Admins can create divisions' }
        }

        const name = formData.get('name') as string
        const description = formData.get('description') as string
        const leadIds = Array.from(
            new Set(
                [
                    ...formData.getAll('leadIds'),
                    formData.get('leadId')
                ]
                    .filter((value): value is string => typeof value === 'string')
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0 && value !== 'none')
            )
        )

        if (!name || name.trim().length === 0) return { error: 'Division Name is required' }
        if (leadIds.length === 0) return { error: 'At least one division lead is required' }

        const allowedLeadIds = await getWorkspaceUserIds(leadIds, user.workspaceId)
        if (allowedLeadIds.length !== leadIds.length) {
            return { error: 'One or more division leads are not in this workspace' }
        }

        const primaryLeadId = getPrimaryProjectLeadId(allowedLeadIds)
        const memberIdsToPersist = mergeProjectMemberIds([], allowedLeadIds)

        // Use interactive transaction to ensure all parts are created or none
        const project = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const p = await tx.project.create({
                data: {
                    name,
                    description: description || null,
                    leadId: primaryLeadId,
                    workspaceId: user.workspaceId
                }
            })

            await tx.projectLeadAssignment.createMany({
                data: allowedLeadIds.map((userId) => ({
                    projectId: p.id,
                    userId
                }))
            })

            await tx.projectMember.createMany({
                data: memberIdsToPersist.map((userId) => ({
                    projectId: p.id,
                    userId
                }))
            })

            await tx.board.create({
                data: {
                    name: 'Kanban Board',
                    projectId: p.id,
                    columns: {
                        create: [
                            { name: 'To Do', order: 0 },
                            { name: 'In Progress', order: 1 },
                            { name: 'Review', order: 2 },
                            { name: 'Done', order: 3 },
                        ]
                    }
                }
            })

            return p
        })

        revalidatePath('/dashboard/projects')
        return { success: true, project }
    } catch (error) {
        console.error('[createProject] Error:', error)
        return { error: 'Failed to create division' }
    }
}

export async function updateProjectLead(projectId: string, leadInput: string | string[] | null) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized' }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace' }
        }

        // Only Admin can change division lead
        if (user.role !== 'Admin') {
            return { error: 'Unauthorized' }
        }

        const requestedLeadIds = Array.from(
            new Set(
                (Array.isArray(leadInput) ? leadInput : [leadInput])
                    .filter((value): value is string => typeof value === 'string')
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0 && value !== 'none')
            )
        )

        const allowedLeadIds = await getWorkspaceUserIds(requestedLeadIds, user.workspaceId)
        if (allowedLeadIds.length !== requestedLeadIds.length) {
            return { error: 'One or more division leads are not in this workspace' }
        }

        const projectContext = await getProjectContext(projectId)
        if (!projectContext || projectContext.workspaceId !== user.workspaceId) {
            return { error: 'Division not found' }
        }

        const primaryLeadId = getPrimaryProjectLeadId(allowedLeadIds)

        await prisma.$transaction(async (tx) => {
            const existingMemberIds = await tx.projectMember.findMany({
                where: { projectId },
                select: { userId: true }
            })

            await tx.project.update({
                where: { id: projectId },
                data: { leadId: primaryLeadId }
            })

            await tx.projectLeadAssignment.deleteMany({
                where: { projectId }
            })

            if (allowedLeadIds.length > 0) {
                await tx.projectLeadAssignment.createMany({
                    data: allowedLeadIds.map((userId) => ({
                        projectId,
                        userId
                    }))
                })
            }

            const memberIdsToPersist = mergeProjectMemberIds(
                existingMemberIds.map((member) => member.userId),
                allowedLeadIds
            )

            await tx.projectMember.deleteMany({
                where: { projectId }
            })

            if (memberIdsToPersist.length > 0) {
                await tx.projectMember.createMany({
                    data: memberIdsToPersist.map((userId) => ({
                        projectId,
                        userId
                    }))
                })
            }
        })

        revalidatePath('/dashboard/projects')
        revalidatePath(`/dashboard/projects/${projectId}`)
        return { success: true }
    } catch (error) {
        console.error('[updateProjectLead] Error:', error)
        return { error: 'Failed to update division lead' }
    }
}
