import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getWorkspaceUserIds } from '@/lib/access'
import {
    createWorkspaceProject,
    listWorkspaceProjects,
    serializeProjectDetail,
    serializeProjectListItem,
    type ProjectPushInput,
} from '@/lib/convex/projects'
import { mergeProjectMemberIds, parseProjectLeadPayload } from '@/lib/project-leads'

function normalizeHexColor(value: unknown): string | null {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed) return null
    const hex = trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(hex) ? hex : null
}

function normalizePushes(value: unknown): ProjectPushInput[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((push) => {
        if (!push || typeof push !== "object") return []

        const record = push as Record<string, unknown>
        const name = typeof record.name === "string" ? record.name.trim() : ""
        const startDate = typeof record.startDate === "string"
            ? Date.parse(record.startDate)
            : typeof record.startDate === "number"
                ? record.startDate
                : Number.NaN

        if (!name || !Number.isFinite(startDate)) {
            return []
        }

        const endDate = typeof record.endDate === "string"
            ? Date.parse(record.endDate)
            : typeof record.endDate === "number"
                ? record.endDate
                : Number.NaN

        return [{
            tempId: typeof record.tempId === "string" && record.tempId.trim().length > 0
                ? record.tempId.trim()
                : undefined,
            name,
            startDate,
            endDate: Number.isFinite(endDate) ? endDate : undefined,
            color: normalizeHexColor(record.color) ?? undefined,
            dependsOn: typeof record.dependsOn === "string" && record.dependsOn.trim().length > 0
                ? record.dependsOn.trim()
                : undefined,
        }]
    })
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const includeLead = searchParams.get('includeLead') === 'true'
        const includeArchived = searchParams.get('includeArchived') === 'true'
        const user = await getCurrentUser()

        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const projects = await listWorkspaceProjects({
            workspaceId: user.workspaceId,
            userId: user.id,
            includeArchived,
            includeLead,
        })

        return NextResponse.json(projects.map(serializeProjectListItem))
    } catch (error) {
        console.error('Failed to fetch projects:', error)
        return NextResponse.json([], { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser()

        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized or No Workspace' }, { status: 403 })
        }

        if (user.role !== 'Admin') {
            return NextResponse.json({ error: 'Forbidden: Only Admins can create divisions' }, { status: 403 })
        }

        const body = await request.json()
        const { name, description, memberIds, color, pushes } = body
        const { leadIds } = parseProjectLeadPayload(body)

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        }

        if (leadIds.length === 0) {
            return NextResponse.json({ error: 'At least one division lead is required' }, { status: 400 })
        }

        const memberIdsInput = Array.isArray(memberIds)
            ? memberIds.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
            : []
        const uniqueMemberIds = Array.from(new Set(memberIdsInput))
        const validLeadIds = await getWorkspaceUserIds(leadIds, user.workspaceId)
        if (validLeadIds.length !== leadIds.length) {
            return NextResponse.json({ error: 'One or more division leads are not in this workspace' }, { status: 400 })
        }

        const validMemberIds = await getWorkspaceUserIds(uniqueMemberIds, user.workspaceId)
        if (validMemberIds.length !== uniqueMemberIds.length) {
            return NextResponse.json({ error: 'One or more members are not in this workspace' }, { status: 400 })
        }

        const result = await createWorkspaceProject({
            workspaceId: user.workspaceId,
            name: name.trim(),
            description: typeof description === "string" && description.trim().length > 0
                ? description.trim()
                : undefined,
            color: normalizeHexColor(color) ?? undefined,
            leadIds: validLeadIds,
            memberIds: mergeProjectMemberIds(validMemberIds, validLeadIds),
            pushes: normalizePushes(pushes),
        })

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(serializeProjectDetail(result.project), { status: 201 })
    } catch (error) {
        console.error('[API] Failed to create division:', error)
        return NextResponse.json({ error: 'Failed to create division' }, { status: 500 })
    }
}
