import { api, createLegacyId, fetchMutation } from "@/lib/convex/server"

export async function createNotificationsInConvex(notifications: Array<{
    workspaceId: string
    userId?: string | null
    type: string
    title: string
    message: string
    link?: string | null
    read?: boolean
    createdAt?: number
}>) {
    if (notifications.length === 0) {
        return { success: true, created: 0 }
    }

    return fetchMutation(api.notifications.createMany, {
        notifications: notifications.map((notification) => ({
            id: createLegacyId("notification"),
            workspaceId: notification.workspaceId,
            userId: notification.userId || undefined,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            link: notification.link || undefined,
            read: notification.read ?? false,
            createdAt: notification.createdAt ?? Date.now(),
        })),
    })
}
