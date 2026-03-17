import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getWorkspaceProjectColumns } from '@/lib/convex/projects'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const columns = await getWorkspaceProjectColumns(id, user.workspaceId)

        if (columns === null) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        return NextResponse.json(columns)
    } catch (error) {
        console.error('Failed to fetch columns:', error)
        return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 })
    }
}
