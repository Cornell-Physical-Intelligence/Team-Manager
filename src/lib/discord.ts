type DiscordEmbed = {
    title?: string
    description?: string
    color?: number
    fields?: { name: string; value: string; inline?: boolean }[]
    footer?: { text: string }
    timestamp?: string
}

export async function sendDiscordNotification(content: string, embeds?: DiscordEmbed[], webhookUrl?: string | null) {
    if (!webhookUrl) {
        console.warn('No Discord webhook URL provided, skipping notification.')
        return false
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                embeds,
            }),
        })

        if (!response.ok) {
            console.error('Failed to send Discord notification:', await response.text())
            return false
        }

        return true
    } catch (error) {
        console.error('Discord webhook error:', error)
        return false
    }
}
