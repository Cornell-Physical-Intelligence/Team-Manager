import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserWorkloadHistoryFromConvex } from '@/lib/convex/settings'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: targetUserId } = await params

        const history = await getUserWorkloadHistoryFromConvex(user.workspaceId, targetUserId)
        if (!history) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({ history })
    } catch (error) {
        console.error('Failed to fetch workload history:', error)
        return NextResponse.json({ error: 'Failed to fetch workload history' }, { status: 500 })
    }
}
