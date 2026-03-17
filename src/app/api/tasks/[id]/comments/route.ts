import { NextResponse } from 'next/server'
import { api, fetchMutation, fetchQuery, createLegacyId } from '@/lib/convex/server'
import { getCurrentUser } from '@/lib/auth'
import { getTaskContext } from '@/lib/access'
import { touchTaskInConvex } from '@/lib/convex/mirror'
import { createNotificationsInConvex } from '@/lib/convex/notifications'
import { getErrorMessage } from '@/lib/errors'

type Comment = {
    id: string
    content: string
    taskId: string
    authorId: string
    authorName: string
    replyToId?: string
    createdAt: number
    replyTo?: {
        id: string
        content: string
        authorName: string
    } | null
}

type CommentWithReplies = Comment & {
    replies: { id: string }[]
}

type TaskMeta = {
    id: string
    projectId: string
    pushId?: string
    columnId?: string
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ comments: [], hasNew: false }, { status: 200 })
        }

        const { id } = await params
        const { searchParams } = new URL(request.url)
        const since = searchParams.get('since') // ISO timestamp for incremental updates
        const countOnly = searchParams.get('countOnly') === 'true'

        // Verify task belongs to user's workspace
        const task = await fetchQuery(api.tasks.getMeta, {
            taskId: id,
            workspaceId: user.workspaceId,
        }) as TaskMeta | null

        if (!task) {
            return NextResponse.json({ comments: [], hasNew: false }, { status: 200 })
        }

        // If countOnly, just return the count for quick polling
        if (countOnly) {
            const count = await fetchQuery(api.tasks.countComments, { taskId: id }) as number
            return NextResponse.json({ count })
        }

        const comments = await fetchQuery(api.tasks.getComments, {
            taskId: id,
            since: since ? new Date(since).getTime() : undefined,
        }) as Comment[]

        // Convert numeric timestamps to ISO strings for backwards compatibility
        const serialized = comments.map((c) => ({
            ...c,
            createdAt: new Date(c.createdAt).toISOString(),
        }))

        return NextResponse.json({
            comments: serialized,
            hasNew: serialized.length > 0,
            lastCheck: new Date().toISOString()
        })
    } catch (error) {
        return NextResponse.json({ comments: [], hasNew: false }, { status: 200 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    let taskId: string | null = null
    try {
        const resolvedParams = await params
        taskId = resolvedParams.id

        if (!taskId) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
        }

        const user = await getCurrentUser()

        if (!user) {
            return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 })
        }

        if (!user.id || user.id === 'pending') {
            return NextResponse.json({ error: 'Please complete your profile setup.' }, { status: 401 })
        }

        if (!user.workspaceId) {
            return NextResponse.json({ error: 'No workspace selected.' }, { status: 403 })
        }
        const workspaceId = user.workspaceId

        let body: { content?: unknown; replyToId?: unknown } = {}
        try {
            body = (await request.json()) as { content?: unknown; replyToId?: unknown }
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { content, replyToId } = body
        const normalizedReplyToId = typeof replyToId === 'string' && replyToId.trim().length > 0
            ? replyToId
            : null

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        // Verify task exists AND belongs to user's workspace
        const taskContext = await getTaskContext(taskId)
        if (!taskContext || taskContext.workspaceId !== workspaceId) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        if (normalizedReplyToId) {
            const replyTarget = await fetchQuery(api.tasks.getComment, {
                commentId: normalizedReplyToId,
            }) as CommentWithReplies | null

            if (!replyTarget || replyTarget.taskId !== taskId) {
                return NextResponse.json({ error: 'Reply target not found' }, { status: 400 })
            }
        }

        const commentId = createLegacyId('comment')
        const now = Date.now()
        const authorName = (user.name || 'User').substring(0, 255)

        const comment = {
            id: commentId,
            taskId,
            content: content.trim(),
            authorId: user.id,
            authorName,
            replyToId: normalizedReplyToId || undefined,
            createdAt: now,
        }

        await fetchMutation(api.mirror.upsertComment, { comment })
        await touchTaskInConvex(taskId, now)

        // Parse @mentions and create notifications
        const mentionRegex = /@(\w+(?:\s+\w+)?)/g
        const mentions = content.match(mentionRegex)

        if (mentions && mentions.length > 0) {
            const mentionNames = mentions.map((m: string) => m.substring(1).toLowerCase())

            // Find users in the same workspace whose name matches any of the mentioned names
            const mentionedMembers = await fetchQuery(api.workspaces.getWorkspaceMembersByNames, {
                workspaceId,
                names: mentionNames,
                excludeUserId: user.id,
            }) as { userId: string; name: string }[]

            // Create notifications for mentioned users
            if (mentionedMembers.length > 0) {
                const projectId = taskContext.projectId
                await createNotificationsInConvex(
                    mentionedMembers.map((mentionedUser) => ({
                        workspaceId,
                        userId: mentionedUser.userId,
                        type: 'mention',
                        title: 'You were mentioned',
                        message: `${user.name} mentioned you in a comment on "${taskContext.title}"`,
                        link: projectId ? `/dashboard/projects/${projectId}?task=${taskId}` : undefined,
                    }))
                )
            }
        }

        // Return comment with ISO string createdAt for backwards compatibility
        return NextResponse.json({
            ...comment,
            createdAt: new Date(comment.createdAt).toISOString(),
            replyTo: null,
        }, { status: 201 })
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error, 'Failed to create comment. Please try again.')
        return NextResponse.json({
            error: errorMessage,
            code: 'UNKNOWN_ERROR'
        }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: taskId } = await params
        const url = new URL(request.url)
        const commentId = url.searchParams.get('commentId')

        if (!commentId) {
            return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
        }

        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const comment = await fetchQuery(api.tasks.getComment, { commentId }) as CommentWithReplies | null

        if (!comment) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        }

        if (comment.taskId !== taskId) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        }

        // Verify comment's task belongs to user's workspace
        const taskMeta = await fetchQuery(api.tasks.getMeta, {
            taskId: comment.taskId,
            workspaceId: user.workspaceId,
        }) as TaskMeta | null

        if (!taskMeta) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        }

        const isAdmin = user.role === 'Admin' || user.role === 'Team Lead'
        const isOwner = comment.authorId === user.id

        if (!isAdmin && !isOwner) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Check if this comment has replies
        const hasReplies = comment.replies && comment.replies.length > 0

        if (hasReplies) {
            // Soft delete - just replace content with [Deleted]
            await fetchMutation(api.mirror.upsertComment, {
                comment: {
                    id: comment.id,
                    taskId: comment.taskId,
                    content: '[Deleted]',
                    authorId: comment.authorId,
                    authorName: 'Deleted',
                    replyToId: comment.replyToId,
                    createdAt: comment.createdAt,
                }
            })
            await touchTaskInConvex(taskId, Date.now())
            return NextResponse.json({ success: true, id: commentId, softDeleted: true })
        } else {
            // Hard delete - no replies, safe to remove
            await fetchMutation(api.mirror.deleteComment, { commentId })
            await touchTaskInConvex(taskId, Date.now())
            return NextResponse.json({ success: true, id: commentId, softDeleted: false })
        }
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
    }
}
