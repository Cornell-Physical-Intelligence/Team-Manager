import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { api, fetchMutation } from '@/lib/convex/server'

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const body = await request.json()
        const { name, skills, interests } = body

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        await fetchMutation(api.auth.updateOnboardingProfile, {
            userId: user.id,
            name: name.trim(),
            skills: skills || [],
            interests: interests || undefined,
            hasOnboarded: true,
            updatedAt: Date.now(),
        })

        return NextResponse.json({ success: true, userId: user.id })
    } catch (error) {
        console.error('Registration error:', error)
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }
}
