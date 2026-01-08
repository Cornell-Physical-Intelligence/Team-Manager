import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

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

        // Verify project belongs to user's workspace
        const project = await prisma.project.findUnique({
            where: { id },
            select: { workspaceId: true }
        })

        if (!project || project.workspaceId !== user.workspaceId) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        const boards = await prisma.board.findMany({
            where: { projectId: id },
            include: {
                columns: {
                    orderBy: { order: 'asc' }
                }
            }
        })

        // Get all columns from all boards
        const columns = boards.flatMap(board => board.columns)

        return NextResponse.json(columns)
    } catch (error) {
        console.error('Failed to fetch columns:', error)
        return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 })
    }
}

