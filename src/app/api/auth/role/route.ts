import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
    try {
        const user = await getCurrentUser()

        if (user) {
            return NextResponse.json({
                id: user.id,
                name: user.name,
                role: user.role,
                avatar: user.avatar,
                workspaceName: user.workspaceName
            })
        }

        return NextResponse.json({ id: null, name: 'Guest', role: 'Member', avatar: null })
    } catch (error) {
        console.error('Failed to get role:', error)
        return NextResponse.json({ id: null, name: 'Guest', role: 'Member', avatar: null })
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const userId = cookieStore.get('user_id')

        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const body = await request.json()
        const { role } = body

        if (!['Admin', 'Team Lead', 'Member'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        // Update user role in database
        await prisma.user.update({
            where: { id: userId.value },
            data: { role }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update role:', error)
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }
}
