import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createNotificationsInConvex } from '@/lib/convex/notifications'
import { api, fetchQuery } from '@/lib/convex/server'

export async function POST() {
    const user = await getCurrentUser()
    if (!user?.workspaceId || !user.id || user.id === 'pending') {
        return NextResponse.json({ created: 0 })
    }

    const now = new Date()
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    try {
        const overdueTasks = await fetchQuery(api.tasks.getOverdueTasks, {
            userId: user.id,
            workspaceId: user.workspaceId,
            now: now.getTime(),
        })

        if (overdueTasks.length === 0) {
            return NextResponse.json({ created: 0 })
        }

        const links = overdueTasks
            .map((task) => task.projectId ? `/dashboard/projects/${task.projectId}?highlight=${task.id}` : null)
            .filter((link): link is string => Boolean(link))

        const existingLinks = new Set(
            links.length > 0
                ? await fetchQuery(api.notifications.listLinksByTypeSince, {
                    workspaceId: user.workspaceId,
                    userId: user.id,
                    type: 'task_due',
                    links,
                    since: cutoff.getTime(),
                })
                : []
        )
        const notificationsToCreate = overdueTasks
            .map((task) => {
                const projectId = task.projectId
                if (!projectId) return null
                const link = `/dashboard/projects/${projectId}?highlight=${task.id}`
                if (existingLinks.has(link)) return null

                return {
                    workspaceId: user.workspaceId,
                    userId: user.id,
                    type: 'task_due',
                    title: 'Task overdue',
                    message: `${task.title} is overdue and needs attention.`,
                    link,
                }
            })
            .filter((notification): notification is {
                workspaceId: string
                userId: string
                type: string
                title: string
                message: string
                link: string
            } => Boolean(notification))

        if (notificationsToCreate.length > 0) {
            await createNotificationsInConvex(notificationsToCreate)
        }

        return NextResponse.json({ created: notificationsToCreate.length })
    } catch (error) {
        console.error('Failed to create overdue notifications:', error)
        return NextResponse.json({ created: 0 }, { status: 200 })
    }
}
