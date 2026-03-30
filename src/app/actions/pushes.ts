'use server'

import { getCurrentUser } from '@/lib/auth'
import { getProjectContext, getTaskContext } from '@/lib/access'
import {
    createPush as convexCreatePush,
    updatePush as convexUpdatePush,
    deletePush as convexDeletePush,
    assignTaskToPush as convexAssignTaskToPush,
    listPushes as convexListPushes,
} from '@/lib/convex/pushes'

export async function createPush(formData: FormData) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized: Only Admins and Team Leads can create pushes' }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace' }
        }

        // RBAC Check - Only Admin and Team Lead can create pushes
        if (user.role !== 'Admin' && user.role !== 'Team Lead') {
            return { error: 'Unauthorized: Only Admins and Team Leads can create pushes' }
        }

        const name = formData.get('name') as string
        const projectId = formData.get('projectId') as string
        const startDate = formData.get('startDate') as string
        const endDate = formData.get('endDate') as string
        const dependsOnId = formData.get('dependsOnId') as string | null
        const color = formData.get('color') as string | null

        if (!name?.trim()) return { error: 'Push name is required' }
        if (!projectId) return { error: 'Project ID is required' }
        if (!startDate) return { error: 'Start date is required' }

        const projectContext = await getProjectContext(projectId)
        if (!projectContext || projectContext.workspaceId !== user.workspaceId) {
            return { error: 'Project not found' }
        }

        const start = new Date(startDate)
        let endMs: number | undefined

        if (endDate) {
            const end = new Date(endDate)
            if (end < start) {
                return { error: 'End date must be after or equal to start date' }
            }
            endMs = end.getTime()
        }

        const result = await convexCreatePush({
            projectId,
            name: name.trim(),
            startDate: start.getTime(),
            endDate: endMs,
            color: color ?? undefined,
            dependsOnId: dependsOnId ?? undefined,
        })

        if ('error' in result) {
            return { error: result.error }
        }

        return { success: true, push: result.push }
    } catch (error) {
        console.error('[createPush] Error:', error)
        return { error: 'Failed to create push' }
    }
}

export async function updatePush(input: {
    id: string
    name?: string
    startDate?: string
    endDate?: string | null
    status?: string
    color?: string
    dependsOnId?: string | null
}) {
    const user = await getCurrentUser()
    if (!user || !user.id || user.id === 'pending') {
        return { error: 'Unauthorized' }
    }

    if (!user.workspaceId) {
        return { error: 'Unauthorized: No workspace' }
    }

    if (user.role !== 'Admin' && user.role !== 'Team Lead') {
        return { error: 'Unauthorized: Only Admins and Team Leads can update pushes' }
    }

    try {
        const convexInput: Parameters<typeof convexUpdatePush>[0] = {
            pushId: input.id,
            workspaceId: user.workspaceId,
        }

        if (input.name) convexInput.name = input.name
        if (input.startDate) convexInput.startDate = new Date(input.startDate).getTime()

        // Handle endDate explicitly if passed (can be null)
        if (input.endDate !== undefined) {
            convexInput.endDate = input.endDate ? new Date(input.endDate).getTime() : null
        }

        if (input.status) convexInput.status = input.status
        if (input.color) convexInput.color = input.color

        // Handle dependsOnId explicitly if passed (can be null)
        if (input.dependsOnId !== undefined) {
            convexInput.dependsOnId = input.dependsOnId ?? null
        }

        const result = await convexUpdatePush(convexInput)

        if ('error' in result) {
            return { error: result.error }
        }

        return { success: true }
    } catch (error) {
        console.error('Failed to update push:', error)
        return { error: 'Failed to update push' }
    }
}

export async function deletePush(pushId: string, projectId: string) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return { error: 'Unauthorized: Only Admins can delete pushes' }
        }

        if (!user.workspaceId) {
            return { error: 'Unauthorized: No workspace' }
        }

        if (user.role !== 'Admin' && user.role !== 'Team Lead') {
            return { error: 'Unauthorized: Only Admins and Team Leads can delete pushes' }
        }

        const result = await convexDeletePush({
            pushId,
            projectId,
            workspaceId: user.workspaceId,
        })

        if ('error' in result) {
            return { error: result.error }
        }

        return { success: true }
    } catch (error) {
        console.error('[deletePush] Error:', error)
        return { error: 'Failed to delete push' }
    }
}

export async function assignTaskToPush(taskId: string, pushId: string | null) {
    const user = await getCurrentUser()
    if (!user || !user.id || user.id === 'pending') {
        return { error: 'Unauthorized' }
    }

    if (!user.workspaceId) {
        return { error: 'Unauthorized: No workspace' }
    }

    try {
        const taskContext = await getTaskContext(taskId)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return { error: 'Task not found' }
        }

        const result = await convexAssignTaskToPush({
            taskId,
            pushId,
            workspaceId: user.workspaceId,
        })

        if ('error' in result) {
            return { error: result.error }
        }

        return { success: true }
    } catch (error) {
        console.error('Failed to assign task to push:', error)
        return { error: 'Failed to assign task' }
    }
}

export async function checkAndUpdatePushStatus(pushId: string) {
    // No-op: Push completion is manual now.
    return
}

export async function getPushes(projectId: string) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return []
        }

        const projectContext = await getProjectContext(projectId)
        if (!projectContext || projectContext.workspaceId !== user.workspaceId) {
            return []
        }

        const pushes = await convexListPushes({
            projectId,
            workspaceId: user.workspaceId,
        })

        return pushes
    } catch (error) {
        console.error('Failed to get pushes:', error)
        return []
    }
}
