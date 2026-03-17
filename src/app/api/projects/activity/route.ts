import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getProjectActivityFromConvex } from '@/lib/convex/settings'

export async function GET() {
    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Check if user is leadership
        if (user.role !== 'Admin' && user.role !== 'Team Lead') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const projectActivity = await getProjectActivityFromConvex(user.workspaceId)

        return NextResponse.json(projectActivity)
    } catch (error) {
        console.error('Failed to fetch project activity:', error)
        return NextResponse.json({ error: 'Failed to fetch project activity' }, { status: 500 })
    }
}
