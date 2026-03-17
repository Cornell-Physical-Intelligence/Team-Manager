import { NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { api, fetchMutation, fetchQuery } from '@/lib/convex/server'
import { getCurrentUser } from '@/lib/auth'
import { getTaskContext } from '@/lib/access'
import { appendActivityLogToConvex } from '@/lib/convex/mirror'
import { getErrorMessage } from '@/lib/errors'

type TaskDoc = {
    id: string
    title: string
    description?: string
    status: string
    assigneeId?: string
    pushId?: string
    columnId?: string
    subteamId?: string
    priority: string
    requireAttachment: boolean
    attachmentFolderId?: string
    attachmentFolderName?: string
    instructionsFileUrl?: string
    instructionsFileName?: string
    progress: number
    enableProgress: boolean
    startDate?: number
    endDate?: number
    dueDate?: number
    submittedAt?: number
    approvedAt?: number
    createdAt: number
    updatedAt: number
}

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

        const task = await fetchQuery(api.tasks.getTaskById, { taskId: id }) as TaskDoc | null

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        return NextResponse.json({
            url: task.instructionsFileUrl ?? null,
            name: task.instructionsFileName ?? null,
        })
    } catch (error) {
        console.error('Failed to fetch instructions:', error)
        return NextResponse.json({ error: 'Failed to fetch instructions' }, { status: 500 })
    }
}

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

        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 })
        }

        const task = await fetchQuery(api.tasks.getTaskById, { taskId: id }) as TaskDoc | null

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        // Delete old instructions file if exists
        if (task.instructionsFileUrl) {
            try {
                await del(task.instructionsFileUrl)
            } catch (e) {
                console.error('Failed to delete old instructions file:', e)
            }
        }

        // Upload to Vercel Blob
        const filename = `instructions/${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const fileBuffer = await file.arrayBuffer()
        console.log(`[INSTRUCTIONS] Processing file: ${filename}, size: ${file.size} bytes`)
        const blob = await put(filename, fileBuffer, {
            access: 'public',
            contentType: file.type || 'application/octet-stream',
        })
        console.log(`[INSTRUCTIONS] Blob created: ${blob.url}`)

        // Update task with instructions file
        await fetchMutation(api.mirror.upsertTask, {
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status || 'Todo',
                assigneeId: task.assigneeId,
                pushId: task.pushId,
                columnId: task.columnId,
                subteamId: task.subteamId,
                priority: task.priority || 'Medium',
                requireAttachment: task.requireAttachment ?? true,
                attachmentFolderId: task.attachmentFolderId,
                attachmentFolderName: task.attachmentFolderName,
                instructionsFileUrl: blob.url,
                instructionsFileName: file.name,
                progress: task.progress ?? 0,
                enableProgress: task.enableProgress ?? false,
                startDate: task.startDate,
                endDate: task.endDate,
                dueDate: task.dueDate,
                submittedAt: task.submittedAt,
                approvedAt: task.approvedAt,
                createdAt: task.createdAt,
                updatedAt: Date.now(),
            },
        })

        // Log activity
        await appendActivityLogToConvex({
            taskId: id,
            taskTitle: task.title,
            action: 'updated',
            field: 'instructionsFile',
            oldValue: task.instructionsFileName || 'None',
            newValue: file.name,
            changedBy: user.id,
            changedByName: user.name || 'User',
            details: `Added instructions file: ${file.name}`,
        })

        console.log(`[INSTRUCTIONS] Task updated with new instructions: ${id}`)
        return NextResponse.json({
            url: blob.url,
            name: file.name
        }, { status: 201 })
    } catch (error: unknown) {
        console.error('Failed to upload instructions:', error)
        const message = getErrorMessage(error)
        const stack = error instanceof Error ? error.stack : undefined
        return NextResponse.json({
            error: `Failed to upload instructions: ${message}`,
            details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
            stack: process.env.NODE_ENV === 'development' ? stack : undefined
        }, { status: 500 })
    }
}

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

        const task = await fetchQuery(api.tasks.getTaskById, { taskId: id }) as TaskDoc | null

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        if (!task.instructionsFileUrl) {
            return NextResponse.json({ error: 'No instructions file to delete' }, { status: 400 })
        }

        // Delete from Vercel Blob
        try {
            await del(task.instructionsFileUrl)
        } catch (e) {
            console.error('Failed to delete from blob storage:', e)
        }

        const oldFileName = task.instructionsFileName

        // Update task to remove instructions file
        await fetchMutation(api.mirror.upsertTask, {
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status || 'Todo',
                assigneeId: task.assigneeId,
                pushId: task.pushId,
                columnId: task.columnId,
                subteamId: task.subteamId,
                priority: task.priority || 'Medium',
                requireAttachment: task.requireAttachment ?? true,
                attachmentFolderId: task.attachmentFolderId,
                attachmentFolderName: task.attachmentFolderName,
                instructionsFileUrl: undefined,
                instructionsFileName: undefined,
                progress: task.progress ?? 0,
                enableProgress: task.enableProgress ?? false,
                startDate: task.startDate,
                endDate: task.endDate,
                dueDate: task.dueDate,
                submittedAt: task.submittedAt,
                approvedAt: task.approvedAt,
                createdAt: task.createdAt,
                updatedAt: Date.now(),
            },
        })

        // Log activity
        await appendActivityLogToConvex({
            taskId: id,
            taskTitle: task.title,
            action: 'updated',
            field: 'instructionsFile',
            oldValue: oldFileName || 'Unknown',
            newValue: 'None',
            changedBy: user.id,
            changedByName: user.name || 'User',
            details: `Removed instructions file: ${oldFileName}`,
        })

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Failed to delete instructions:', error)
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }
}
