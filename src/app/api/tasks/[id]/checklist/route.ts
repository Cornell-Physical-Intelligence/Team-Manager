import { NextResponse } from 'next/server'
import { api, fetchMutation, fetchQuery, createLegacyId } from '@/lib/convex/server'
import { getCurrentUser } from '@/lib/auth'
import { getTaskContext } from '@/lib/access'
import {
    appendActivityLogToConvex,
    touchTaskInConvex,
} from '@/lib/convex/mirror'

type ChecklistItem = {
    id: string
    taskId: string
    content: string
    completed: boolean
    completedBy?: string
    completedAt?: number
    order: number
    createdBy: string
    createdAt: number
    updatedAt: number
}

// GET - Fetch all checklist items for a task
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

        const items = await fetchQuery(api.tasks.getChecklistItems, { taskId: id })
        return NextResponse.json(items)
    } catch (error) {
        console.error('Failed to fetch checklist:', error)
        return NextResponse.json([], { status: 200 })
    }
}

// POST - Create a new checklist item
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

        const taskContext = await getTaskContext(id)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        const body = await request.json()
        const { content } = body

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        // Get max order
        const maxOrder = await fetchQuery(api.tasks.getMaxChecklistOrder, { taskId: id })

        const itemId = createLegacyId('checklist_item')
        const now = Date.now()
        const item: ChecklistItem = {
            id: itemId,
            taskId: id,
            content: content.trim(),
            order: maxOrder + 1,
            completed: false,
            createdBy: user.id,
            createdAt: now,
            updatedAt: now,
        }

        await fetchMutation(api.mirror.upsertTaskChecklistItem, { item })

        // Log activity
        await appendActivityLogToConvex({
            taskId: id,
            taskTitle: taskContext.title || 'Untitled Task',
            action: 'updated',
            field: 'checklist',
            newValue: content.trim(),
            changedBy: user.id,
            changedByName: user.name || 'User',
            details: `Added checklist item: "${content.trim()}"`,
        })
        await touchTaskInConvex(id, now)

        return NextResponse.json(item, { status: 201 })
    } catch (error) {
        console.error('Failed to create checklist item:', error)
        return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 })
    }
}

// PATCH - Update checklist item (toggle completion or reorder)
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

        const taskContext = await getTaskContext(id)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        const body = await request.json()
        const { itemId, completed, content, reorder } = body

        // Handle reordering
        if (reorder && Array.isArray(reorder)) {
            const allItems = await fetchQuery(api.tasks.getChecklistItems, { taskId: id }) as ChecklistItem[]
            const itemMap = new Map(allItems.map((item) => [item.id, item]))

            await Promise.all(
                reorder.map((reorderedItemId: string, index: number) => {
                    const existing = itemMap.get(reorderedItemId)
                    if (!existing || existing.taskId !== id) return Promise.resolve()
                    return fetchMutation(api.mirror.upsertTaskChecklistItem, {
                        item: { ...existing, order: index },
                    })
                })
            )
            await touchTaskInConvex(id, Date.now())
            return NextResponse.json({ success: true })
        }

        if (!itemId) {
            return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
        }

        // Verify item exists and belongs to task
        const item = await fetchQuery(api.tasks.getChecklistItem, { itemId }) as ChecklistItem | null

        if (!item || item.taskId !== id) {
            return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
        }

        const now = Date.now()
        const updatedItem: ChecklistItem = {
            ...item,
            updatedAt: now,
        }

        if (typeof completed === 'boolean') {
            updatedItem.completed = completed
            updatedItem.completedBy = completed ? user.id : undefined
            updatedItem.completedAt = completed ? now : undefined
        }

        if (typeof content === 'string') {
            updatedItem.content = content.trim()
        }

        await fetchMutation(api.mirror.upsertTaskChecklistItem, { item: updatedItem })

        // Log activity for completion toggle
        if (typeof completed === 'boolean' && taskContext.title) {
            await appendActivityLogToConvex({
                taskId: id,
                taskTitle: taskContext.title || 'Untitled Task',
                action: 'updated',
                field: 'checklist',
                oldValue: completed ? 'incomplete' : 'complete',
                newValue: completed ? 'complete' : 'incomplete',
                changedBy: user.id,
                changedByName: user.name || 'User',
                details: `${completed ? 'Completed' : 'Uncompleted'} checklist item: "${item.content}"`,
            })
        }
        await touchTaskInConvex(id, now)

        return NextResponse.json(updatedItem)
    } catch (error) {
        console.error('Failed to update checklist item:', error)
        return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 })
    }
}

// DELETE - Delete a checklist item
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

        const taskContext = await getTaskContext(id)
        if (!taskContext || taskContext.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        const url = new URL(request.url)
        const itemId = url.searchParams.get('itemId')

        if (!itemId) {
            return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
        }

        // Verify item exists and belongs to task
        const item = await fetchQuery(api.tasks.getChecklistItem, { itemId }) as ChecklistItem | null

        if (!item || item.taskId !== id) {
            return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
        }

        await fetchMutation(api.mirror.deleteTaskChecklistItem, { itemId })

        // Log activity
        if (taskContext.title) {
            await appendActivityLogToConvex({
                taskId: id,
                taskTitle: taskContext.title,
                action: 'updated',
                field: 'checklist',
                oldValue: item.content,
                changedBy: user.id,
                changedByName: user.name || 'User',
                details: `Removed checklist item: "${item.content}"`,
            })
        }
        await touchTaskInConvex(id, Date.now())

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete checklist item:', error)
        return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 })
    }
}
