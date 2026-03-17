import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { api, createLegacyId, fetchMutation, fetchQuery } from '@/lib/convex/server'

export async function GET(request: Request) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser || !currentUser.workspaceId) {
            return NextResponse.json([])
        }

        const { searchParams } = new URL(request.url)
        const role = searchParams.get('role')

        // Optional pagination parameters (backward compatible - returns all if not specified)
        const pageParam = searchParams.get('page')
        const limitParam = searchParams.get('limit')
        const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : null
        const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50)) : null

        // If role=leads, return only Admin and Team Lead users
        if (role === 'leads') {
            const result = await fetchQuery(api.admin.getWorkspaceUsers, {
                workspaceId: currentUser.workspaceId,
                role: 'leads',
                ...(page && limit ? { page, limit } : {}),
            })
            const users = result.users.map((user) => ({
                id: user.id,
                name: user.name,
                role: user.role
            }))

            return NextResponse.json(users)
        }

        const result = await fetchQuery(api.admin.getWorkspaceUsers, {
            workspaceId: currentUser.workspaceId,
            ...(page && limit ? { page, limit } : {}),
        })
        const users = result.users

        // Return paginated response if pagination params provided
        if (page && limit) {
            return NextResponse.json({
                users,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit)
                }
            })
        }

        // Backward compatible: return array directly
        return NextResponse.json(users)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        // SECURITY: Require authentication
        const currentUser = await getCurrentUser()
        if (!currentUser || !currentUser.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // SECURITY: Only Admins can create users
        if (currentUser.role !== 'Admin') {
            return NextResponse.json({ error: 'Forbidden: Only Admins can create users' }, { status: 403 })
        }

        const body = await request.json()
        const { email, name, role } = body

        // Input validation
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
        }
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        // Validate role - only allow valid roles, and only Admin can create other Admins
        const validRoles = ['Member', 'Team Lead', 'Admin']
        const userRole = role && validRoles.includes(role) ? role : 'Member'

        if (userRole === 'Admin' && currentUser.role !== 'Admin') {
            return NextResponse.json({ error: 'Forbidden: Only Admins can create Admin users' }, { status: 403 })
        }

        const workspaceId = currentUser.workspaceId
        const now = Date.now()
        const result = await fetchMutation(api.admin.createWorkspaceUser, {
            id: createLegacyId('user'),
            workspaceMemberId: createLegacyId('workspace_member'),
            workspaceId,
            email: email.trim().toLowerCase(),
            name: name.trim(),
            role: userRole,
            now,
        })

        if ('error' in result && result.error === 'duplicate_email') {
            return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
        }

        return NextResponse.json(result)
    } catch (error: unknown) {
        console.error('[POST /api/users] Error:', error)
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }
}
