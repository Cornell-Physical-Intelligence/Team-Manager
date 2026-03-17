
import { NextResponse } from 'next/server'
import { getConvexCurrentUser } from '@/lib/convex/current-user'
import { api, fetchMutation, fetchQuery } from '@/lib/convex/server'

export async function GET(request: Request) {
    try {
        const user = await getConvexCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const rawLimit = parseInt(searchParams.get('limit') || '50')
        const limit = Math.min(Math.max(1, rawLimit), 200) // Clamp between 1 and 200
        const since = searchParams.get('since') // ISO timestamp for incremental updates

        const messages = await fetchQuery(api.chat.listMessages, {
            workspaceId: user.workspaceId,
            limit,
            since: since ? new Date(since).getTime() : undefined,
        })

        return NextResponse.json(
            messages.map((message) => ({
                ...message,
                authorAvatar: message.authorAvatar ?? null,
                createdAt: new Date(message.createdAt).toISOString(),
            }))
        )
    } catch (error) {
        console.error('Failed to fetch chat messages:', error)
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const user = await getConvexCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await request.json()
        const { content, type } = body

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 })
        }

        const created = await fetchMutation(api.chat.createMessage, {
            content,
            type: type || 'text',
            authorId: user.id,
            authorName: user.name || 'User',
            authorAvatar: user.avatar || undefined,
            workspaceId: user.workspaceId,
        })

        const message = {
            ...created.message,
            authorAvatar: created.message.authorAvatar ?? null,
            createdAt: new Date(created.message.createdAt).toISOString(),
        }

        // -- Discord Integration Start --
        try {
            // Only proceed if there's a potential mention ('@')
            if (!content.includes('@')) return NextResponse.json(message)

            // Import dynamically to avoid circular deps if any (though static import is fine usually)
            const { sendDiscordNotification } = await import('@/lib/discord')

            // 2. Resolve mentions
            let discordContent = content
            let hasMentions = false

            // Sort by name length desc to avoid partial matches (e.g. matching "Rob" inside "Robert")
            const sortedMembers = [...created.mentionableMembers].sort((a, b) => b.name.length - a.name.length)

            for (const member of sortedMembers) {
                if (!member.discordId) continue

                const mentionString = `@${member.name}`
                if (discordContent.includes(mentionString)) {
                    // Replace all occurrences
                    // Note: String.replaceAll is standard in Node 15+
                    discordContent = discordContent.split(mentionString).join(`<@${member.discordId}>`)
                    hasMentions = true
                }
            }

            // Handle @everyone
            if (discordContent.includes('@everyone')) {
                // Discord webhook allows @everyone if configured, usually passes through
                hasMentions = true
            }

            // 3. Send to Discord
            const finalMessage = discordContent

            // Only send if it has mentions (User asked: "only bring chats to the discrod if they at somehting")
            if (hasMentions && created.discordChannelId) {
                await sendDiscordNotification(
                    "",
                    [{
                        title: "💬 Chat Mention",
                        description: finalMessage,
                        color: 0x5865F2,
                        timestamp: new Date().toISOString(),
                    }],
                    created.discordChannelId
                )
            }

        } catch (discordErr) {
            console.error('Failed to send Discord notification for chat:', discordErr)
            // Don't fail the request if Discord fails
        }
        // -- Discord Integration End --

        return NextResponse.json(message)
    } catch (error) {
        console.error('Failed to send message:', error)
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}
