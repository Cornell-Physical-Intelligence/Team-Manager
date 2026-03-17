import { NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { getCurrentUser } from '@/lib/auth'
import { getTaskContext } from '@/lib/access'
import {
    appendActivityLogToConvex,
    deleteTaskAttachmentFromConvex,
    touchTaskInConvex,
    upsertTaskAttachmentToConvex,
} from '@/lib/convex/mirror'
import { driveConfigTableExists, getDriveClientForWorkspace, getDriveFolderCache, isFolderWithinRoot } from '@/lib/googleDrive'
import { buildAttachmentAccessUrl, buildAttachmentStoragePath, isAllowedAttachmentType, MAX_ATTACHMENT_SIZE } from '@/lib/attachments'
import { getErrorMessage } from '@/lib/errors'
import { Readable } from 'stream'
import { api, createLegacyId, fetchQuery } from '@/lib/convex/server'

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

        const attachments = await fetchQuery(api.tasks.getAttachments, { taskId: id })
        return NextResponse.json(
            attachments.map((attachment) => ({
                ...attachment,
                url: buildAttachmentAccessUrl(attachment.id)
            }))
        )
    } catch (error) {
        console.error('Failed to fetch attachments:', error)
        return NextResponse.json([], { status: 200 })
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

        if (file.size > MAX_ATTACHMENT_SIZE) {
            return NextResponse.json({ error: 'File too large. Maximum size is 50MB' }, { status: 400 })
        }

        if (!isAllowedAttachmentType(file.name, file.type || '')) {
            return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
        }

        // Get task's attachmentFolderId from Convex
        const task = await fetchQuery(api.tasks.getTaskById, { taskId: id })

        let driveConfig: { refreshToken: string | null; folderId: string | null } | null = null
        if (await driveConfigTableExists()) {
            const cfg = await fetchQuery(api.settings.getWorkspaceDriveConfig, { workspaceId: user.workspaceId })
            if (cfg) {
                driveConfig = { refreshToken: cfg.refreshToken ?? null, folderId: cfg.folderId ?? null }
            }
        }

        const hasDrive = !!driveConfig?.refreshToken && !!driveConfig.folderId
        const rootFolderId = driveConfig?.folderId || null
        const targetFolderId = task?.attachmentFolderId || null

        let attachmentUrl = ''
        let storageProvider = 'vercel'
        let externalId: string | null = null

        const shouldUploadToDrive = hasDrive && !!rootFolderId && !!targetFolderId

        if (shouldUploadToDrive) {
            const drive = await getDriveClientForWorkspace(user.workspaceId)
            if (rootFolderId && targetFolderId && targetFolderId !== rootFolderId) {
                const cached = await getDriveFolderCache(user.workspaceId)
                if (!isFolderWithinRoot(cached, rootFolderId, targetFolderId)) {
                    return NextResponse.json({ error: 'Upload folder is outside the configured Drive root' }, { status: 400 })
                }
            }

            const fileBuffer = await file.arrayBuffer()
            const driveResponse = await drive.files.create({
                requestBody: {
                    name: file.name,
                    parents: targetFolderId ? [targetFolderId] : undefined,
                },
                media: {
                    mimeType: file.type || "application/octet-stream",
                    body: Readable.from(Buffer.from(fileBuffer)),
                },
                fields: "id, name, webViewLink, webContentLink, mimeType",
                supportsAllDrives: true,
            })

            const fileId = driveResponse.data.id || ""
            if (!fileId) {
                return NextResponse.json({ error: 'Failed to upload to Google Drive' }, { status: 500 })
            }

            attachmentUrl = fileId
            storageProvider = 'google'
            externalId = fileId
        } else {
            const filename = buildAttachmentStoragePath(id, file.name)
            const fileBuffer = await file.arrayBuffer()
            const blob = await put(filename, fileBuffer, {
                access: 'public',
                contentType: file.type || 'application/octet-stream',
            })
            attachmentUrl = blob.url
            storageProvider = 'vercel'
            externalId = null
        }

        // Get max order for this task from Convex
        const existingAttachments = await fetchQuery(api.tasks.getAttachments, { taskId: id })
        const maxOrder = existingAttachments.length > 0
            ? Math.max(...existingAttachments.map((a) => a.order))
            : -1

        // Create attachment in Convex
        const attachmentId = createLegacyId('attachment')
        const now = Date.now()
        const attachment = {
            id: attachmentId,
            taskId: id,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url: attachmentUrl,
            storageProvider,
            externalId: externalId || undefined,
            uploadedBy: user.name || 'User',
            order: maxOrder + 1,
            createdAt: now,
        }
        await upsertTaskAttachmentToConvex(attachment)

        // Log activity for attachment being added
        await appendActivityLogToConvex({
            taskId: id,
            taskTitle: taskContext.title || 'Untitled Task',
            action: 'updated',
            field: 'attachment',
            oldValue: 'None',
            newValue: file.name,
            changedBy: user.id,
            changedByName: user.name || 'User',
            details: `Added media file: ${file.name}`,
        })
        await touchTaskInConvex(id, now)

        return NextResponse.json({
            ...attachment,
            url: buildAttachmentAccessUrl(attachment.id)
        }, { status: 201 })
    } catch (error: unknown) {
        console.error('Failed to upload attachment:', error)
        const message = getErrorMessage(error)
        const stack = error instanceof Error ? error.stack : undefined
        return NextResponse.json({
            error: `Failed to upload attachment: ${message}`,
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

        const url = new URL(request.url)
        const attachmentId = url.searchParams.get('attachmentId')

        if (!attachmentId) {
            return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 })
        }

        // Verify attachment exists and belongs to task via Convex
        const attachment = await fetchQuery(api.tasks.getAttachment, { attachmentId })

        if (!attachment || attachment.taskId !== id) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
        }

        if (attachment.storageProvider === 'google' && attachment.externalId) {
            try {
                const drive = await getDriveClientForWorkspace(user.workspaceId)
                await drive.files.delete({
                    fileId: attachment.externalId,
                    supportsAllDrives: true,
                })
            } catch (e) {
                console.error('Failed to delete from Google Drive:', e)
            }
        } else {
            // Delete from Vercel Blob
            try {
                await del(attachment.url)
            } catch (e) {
                console.error('Failed to delete from blob storage:', e)
            }
        }

        await deleteTaskAttachmentFromConvex(attachmentId)

        // Log activity for attachment being deleted
        if (taskContext.title) {
            await appendActivityLogToConvex({
                taskId: id,
                taskTitle: taskContext.title,
                action: 'updated',
                field: 'attachment',
                oldValue: attachment.name,
                newValue: 'None',
                changedBy: user.id,
                changedByName: user.name || 'User',
                details: `Deleted media file: ${attachment.name}`,
            })
        }
        await touchTaskInConvex(id, Date.now())

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Failed to delete attachment:', error)
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }
}

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
        const { attachmentIds } = body

        if (!Array.isArray(attachmentIds)) {
            return NextResponse.json({ error: 'attachmentIds array is required' }, { status: 400 })
        }

        // Fetch all attachments for the task from Convex
        const existingAttachments = await fetchQuery(api.tasks.getAttachments, { taskId: id })
        const attachmentMap = new Map(existingAttachments.map((a) => [a.id, a]))

        // Filter to only attachments in the reorder list that belong to this task
        const toReorder = attachmentIds
            .map((aId: string) => attachmentMap.get(aId))
            .filter((a): a is NonNullable<typeof a> => a != null && a.taskId === id)

        // Update order for all attachments in Convex
        await Promise.all(
            toReorder.map((attachment, index) =>
                upsertTaskAttachmentToConvex({ ...attachment, order: index })
            )
        )

        // Log activity for attachment reordering
        if (taskContext.title && toReorder.length > 0) {
            await appendActivityLogToConvex({
                taskId: id,
                taskTitle: taskContext.title,
                action: 'updated',
                field: 'attachment',
                oldValue: 'Previous order',
                newValue: 'Reordered',
                changedBy: user.id,
                changedByName: user.name || 'User',
                details: `Reordered media files: ${toReorder.map(a => a.name).join(', ')}`,
            })
        }
        await touchTaskInConvex(id, Date.now())

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Failed to reorder attachments:', error)
        return NextResponse.json({ error: 'Failed to reorder files' }, { status: 500 })
    }
}
