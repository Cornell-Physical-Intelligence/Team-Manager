import { NextResponse } from 'next/server'
import { getCurrentUser } from "@/lib/auth"
import { api, fetchQuery } from "@/lib/convex/server"

export async function GET() {
    try {
        const user = await getCurrentUser()

        if (!user?.workspaceId) {
            return NextResponse.json([])
        }

        const subteams = await fetchQuery(api.settings.getSubteams, { workspaceId: user.workspaceId })
        return NextResponse.json(subteams)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch subteams' }, { status: 500 })
    }
}
