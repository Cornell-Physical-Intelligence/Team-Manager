import { NextResponse } from 'next/server'
import { api, fetchMutation, fetchQuery, createLegacyId } from '@/lib/convex/server'
import { getCurrentUser } from '@/lib/auth'
import { getTaskContext } from '@/lib/access'
import {
    appendActivityLogToConvex,
    touchTaskInConvex,
} from '@/lib/convex/mirror'
import { createNotificationsInConvex } from '@/lib/convex/notifications'

type HelpRequest = {
    id: string
    taskId: string
    requestedBy: string
    requestedByName: string
    message?: string
    status: string
    resolvedBy?: string
    resolvedByName?: string
    resolvedAt?: number
    createdAt: number
    updatedAt: number
}

// GET - Get help request for a task
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getCurrentUser()

        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const taskContext = await getTaskContext(id)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        const helpRequests = await fetchQuery(api.tasks.getHelpRequests, {
            taskId: id,
            statuses: ['open', 'acknowledged'],
        }) as HelpRequest[]
        return NextResponse.json(helpRequests[0] ?? null)
    } catch (error) {
        console.error('Failed to fetch help request:', error)
        return NextResponse.json(null, { status: 200 })
    }
}

// POST - Create a help request (ask for help)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getCurrentUser()

        if (!user || !user.id || user.id === 'pending') {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        if (!user.workspaceId) {
            return NextResponse.json({ error: 'No workspace' }, { status: 403 })
        }

        const body = await request.json()
        const { message } = body

        // Verify task exists and get project info for notification
        const taskContext = await getTaskContext(id)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        const workspaceId = taskContext.workspaceId
        const projectId = taskContext.projectId

        // Check if there's already an open help request
        const existingRequests = await fetchQuery(api.tasks.getHelpRequests, {
            taskId: id,
            statuses: ['open', 'acknowledged'],
        }) as HelpRequest[]

        if (existingRequests.length > 0) {
            return NextResponse.json({ error: 'Help request already exists for this task' }, { status: 400 })
        }

        // Create the help request
        const helpRequestId = createLegacyId('help_request')
        const now = Date.now()
        const helpRequest: HelpRequest = {
            id: helpRequestId,
            taskId: id,
            requestedBy: user.id,
            requestedByName: user.name || 'User',
            message: message?.trim() || undefined,
            status: 'open',
            createdAt: now,
            updatedAt: now,
        }
        await fetchMutation(api.mirror.upsertHelpRequest, { helpRequest })

        // Log activity
        await appendActivityLogToConvex({
            taskId: id,
            taskTitle: taskContext.title,
            action: 'help_requested',
            field: 'help',
            newValue: 'open',
            changedBy: user.id,
            changedByName: user.name || 'User',
            details: message ? `Asked for help: "${message}"` : 'Asked for help on this task',
        })
        await touchTaskInConvex(id, now)

        // Create notification for project lead and admins
        if (workspaceId && projectId) {
            // Get project lead IDs
            const projectDetails = await fetchQuery(api.projectsAdmin.getProjectDetails, {
                projectId,
            }) as { leads: { id: string }[] } | null

            const leadIds = Array.from(
                new Set(
                    (projectDetails?.leads || [])
                        .map((lead) => lead.id)
                        .filter((leadId) => leadId !== user.id)
                )
            )

            if (leadIds.length > 0) {
                await createNotificationsInConvex(
                    leadIds.map((leadId) => ({
                        workspaceId,
                        userId: leadId,
                        type: 'help_requested',
                        title: 'Help Requested',
                        message: `${user.name} needs help with "${taskContext.title}"${message ? `: ${message}` : ''}`,
                        link: `/dashboard/projects/${projectId}?task=${id}`,
                    }))
                )
            }

            // Notify admins in the workspace
            const adminMembers = await fetchQuery(api.workspaces.getWorkspaceAdmins, {
                workspaceId,
                excludeUserIds: [user.id, ...leadIds],
            }) as { userId: string }[]

            if (adminMembers.length > 0) {
                await createNotificationsInConvex(
                    adminMembers.map((admin) => ({
                        workspaceId,
                        userId: admin.userId,
                        type: 'help_requested',
                        title: 'Help Requested',
                        message: `${user.name} needs help with "${taskContext.title}"${message ? `: ${message}` : ''}`,
                        link: `/dashboard/projects/${projectId}?task=${id}`,
                    }))
                )
            }
        }

        return NextResponse.json(helpRequest, { status: 201 })
    } catch (error) {
        console.error('Failed to create help request:', error)
        return NextResponse.json({ error: 'Failed to create help request' }, { status: 500 })
    }
}

// PATCH - Update help request (acknowledge or resolve)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getCurrentUser()

        if (!user || !user.id || user.id === 'pending') {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        if (!user.workspaceId) {
            return NextResponse.json({ error: 'No workspace' }, { status: 403 })
        }

        const isLeadership = user.role === 'Admin' || user.role === 'Team Lead'
        if (!isLeadership) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await request.json()
        const { status, helpRequestId } = body

        if (!helpRequestId) {
            return NextResponse.json({ error: 'Help request ID is required' }, { status: 400 })
        }

        if (!['acknowledged', 'resolved'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        // Verify help request exists and belongs to task
        const helpRequest = await fetchQuery(api.tasks.getHelpRequest, { helpRequestId }) as HelpRequest | null

        if (!helpRequest || helpRequest.taskId !== id) {
            return NextResponse.json({ error: 'Help request not found' }, { status: 404 })
        }

        // Validate workspace via task context
        const taskContext = await getTaskContext(id)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Help request not found' }, { status: 404 })
        }

        const nextStatus = status as 'acknowledged' | 'resolved'
        const now = Date.now()
        const updatedHelpRequest: HelpRequest = {
            ...helpRequest,
            status: nextStatus,
            updatedAt: now,
        }

        if (nextStatus === 'resolved') {
            updatedHelpRequest.resolvedBy = user.id
            updatedHelpRequest.resolvedByName = user.name || 'User'
            updatedHelpRequest.resolvedAt = now
        }

        await fetchMutation(api.mirror.upsertHelpRequest, { helpRequest: updatedHelpRequest })

        // Log activity
        await appendActivityLogToConvex({
            taskId: id,
            taskTitle: taskContext.title,
            action: nextStatus === 'resolved' ? 'help_resolved' : 'help_acknowledged',
            field: 'help',
            oldValue: helpRequest.status,
            newValue: nextStatus,
            changedBy: user.id,
            changedByName: user.name || 'User',
            details: nextStatus === 'resolved' ? 'Resolved help request' : 'Acknowledged help request',
        })

        // Notify the requester
        const workspaceId = taskContext.workspaceId
        const projectId = taskContext.projectId
        if (workspaceId && projectId && helpRequest.requestedBy !== user.id) {
            await createNotificationsInConvex([{
                workspaceId,
                userId: helpRequest.requestedBy,
                type: nextStatus === 'resolved' ? 'help_resolved' : 'help_acknowledged',
                title: nextStatus === 'resolved' ? 'Help Request Resolved' : 'Help Request Acknowledged',
                message: `${user.name} ${nextStatus === 'resolved' ? 'resolved' : 'acknowledged'} your help request on "${taskContext.title}"`,
                link: `/dashboard/projects/${projectId}?task=${id}`,
            }])
        }

        await touchTaskInConvex(id, now)

        return NextResponse.json(updatedHelpRequest)
    } catch (error) {
        console.error('Failed to update help request:', error)
        return NextResponse.json({ error: 'Failed to update help request' }, { status: 500 })
    }
}

// DELETE - Cancel a help request
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getCurrentUser()

        if (!user || !user.id || user.id === 'pending') {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }

        if (!user.workspaceId) {
            return NextResponse.json({ error: 'No workspace' }, { status: 403 })
        }

        const url = new URL(request.url)
        const helpRequestId = url.searchParams.get('helpRequestId')

        if (!helpRequestId) {
            return NextResponse.json({ error: 'Help request ID is required' }, { status: 400 })
        }

        // Verify help request exists and belongs to task
        const helpRequest = await fetchQuery(api.tasks.getHelpRequest, { helpRequestId }) as HelpRequest | null

        if (!helpRequest || helpRequest.taskId !== id) {
            return NextResponse.json({ error: 'Help request not found' }, { status: 404 })
        }

        // Only the requester or admins can cancel
        if (helpRequest.requestedBy !== user.id && user.role !== 'Admin' && user.role !== 'Team Lead') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const taskContext = await getTaskContext(id)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Help request not found' }, { status: 404 })
        }

        await fetchMutation(api.mirror.deleteHelpRequest, { helpRequestId })

        // Log activity
        await appendActivityLogToConvex({
            taskId: id,
            taskTitle: taskContext.title,
            action: 'help_cancelled',
            field: 'help',
            oldValue: helpRequest.status,
            newValue: 'cancelled',
            changedBy: user.id,
            changedByName: user.name || 'User',
            details: 'Cancelled help request',
        })
        await touchTaskInConvex(id, Date.now())

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete help request:', error)
        return NextResponse.json({ error: 'Failed to delete help request' }, { status: 500 })
    }
}
