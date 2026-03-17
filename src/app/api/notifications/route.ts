import { NextResponse } from 'next/server'
import { getConvexCurrentUser } from '@/lib/convex/current-user'
import { api, fetchMutation, fetchQuery } from '@/lib/convex/server'

export async function GET(request: Request) {
    try {
        const user = await getConvexCurrentUser()

        if (!user || !user.id || user.id === 'pending' || !user.workspaceId) {
            return NextResponse.json({ notifications: [], hasNew: false })
        }

        const { searchParams } = new URL(request.url)
        const since = searchParams.get('since') // ISO timestamp for incremental updates
        const countOnly = searchParams.get('countOnly') === 'true' // Just check for new ones

        // If countOnly, just check if there are unread notifications
        if (countOnly) {
            const unreadCount = await fetchQuery(api.notifications.getUnreadCount, {
                workspaceId: user.workspaceId,
                userId: user.id,
            })

            return NextResponse.json({ unreadCount, hasNew: unreadCount > 0 })
        }

        const notifications = await fetchQuery(api.notifications.listForUser, {
            workspaceId: user.workspaceId,
            userId: user.id,
            since: since ? new Date(since).getTime() : undefined,
            limit: 20,
        })

        const serializedNotifications = notifications.map((notification) => ({
            ...notification,
            link: notification.link ?? null,
            createdAt: new Date(notification.createdAt).toISOString(),
        }))

        return NextResponse.json({
            notifications: serializedNotifications,
            hasNew: serializedNotifications.length > 0,
            lastCheck: new Date().toISOString()
        })
    } catch (error) {
        console.error('Failed to fetch notifications:', error)
        return NextResponse.json({ notifications: [], hasNew: false })
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await getConvexCurrentUser()

        if (!user || !user.id || user.id === 'pending' || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { notificationId, markAllRead } = await request.json()

        if (markAllRead) {
            await fetchMutation(api.notifications.markAllRead, {
                workspaceId: user.workspaceId,
                userId: user.id,
            })
        } else if (notificationId) {
            const result = await fetchMutation(api.notifications.markRead, {
                workspaceId: user.workspaceId,
                userId: user.id,
                notificationId,
            })

            if ("error" in result) {
                return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update notification:', error)
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
}
