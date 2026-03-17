import { NextResponse } from 'next/server'
import { getCurrentUser } from "@/lib/auth"
import { api, fetchMutation, fetchQuery } from "@/lib/convex/server"

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
        const currentUser = await getCurrentUser()

        if (!currentUser || !currentUser.id || currentUser.id === 'pending') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Only admins can change roles
        if (currentUser.role !== 'Admin') {
            return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 })
        }

        if (!currentUser.workspaceId) {
            return NextResponse.json({ error: 'No workspace' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, role } = body

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        if (!['Admin', 'Team Lead', 'Member'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const managedUser = await fetchQuery(api.admin.getManagedUser, {
            workspaceId: currentUser.workspaceId,
            userId,
        })

        if (!managedUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const workspaceId = currentUser.workspaceId
        const targetUser = managedUser.user
        const membership = managedUser.membership
        const targetRole = membership?.role ?? (targetUser.workspaceId === workspaceId ? targetUser.role : null)

        if (targetRole === 'Admin' && currentUser.role !== 'Admin') {
            return NextResponse.json({ error: 'Only admins can modify other Admins' }, { status: 403 })
        }

        if (role === 'Admin' && currentUser.role !== 'Admin') {
            return NextResponse.json({ error: 'Only admins can promote users to Admin' }, { status: 403 })
        }

        if (currentUser.id === userId && role !== 'Admin') {
            const adminCount = await fetchQuery(api.admin.countWorkspaceAdmins, { workspaceId })

            if (adminCount <= 1) {
                return NextResponse.json({
                    error: 'Cannot remove your admin role: You are the only admin. Please assign another admin first.',
                    requiresAdminAssignment: true
                }, { status: 400 })
            }
        }

        const result = await fetchMutation(api.admin.setWorkspaceMemberRole, {
            workspaceId,
            userId,
            role,
            fallbackName: targetUser.name || 'User',
        })

        if ('error' in result) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to update role:', error)
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }
}
