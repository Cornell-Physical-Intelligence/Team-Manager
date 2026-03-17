import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getWorkspaceUserIds } from '@/lib/access'
import {
    deleteWorkspaceProject,
    getWorkspaceProject,
    serializeProjectDetail,
    updateWorkspaceProject,
} from '@/lib/convex/projects'
import {
    mergeProjectMemberIds,
    parseProjectLeadPayload,
} from '@/lib/project-leads'

function normalizeHexColor(value: unknown): string | null {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed) return null
    const hex = trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(hex) ? hex : null
}

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
        const project = await getWorkspaceProject(id, user.workspaceId)

        if (!project) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json(serializeProjectDetail(project))
    } catch (error) {
        console.error('Failed to fetch project:', error)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        if (user.role !== 'Admin' && user.role !== 'Team Lead') {
            return NextResponse.json({ error: 'Forbidden: Only Admins and Team Leads can update divisions' }, { status: 403 })
        }

        const { id } = await params
        const existingProject = await getWorkspaceProject(id, user.workspaceId)

        if (!existingProject) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const canManageAsLead = existingProject.leadIds.includes(user.id) || existingProject.leadId === user.id
        if (user.role === 'Team Lead' && !canManageAsLead) {
            return NextResponse.json({ error: 'Forbidden: You can only update projects you lead' }, { status: 403 })
        }

        const body = await request.json()
        const { name, description, memberIds, color, archived } = body
        const normalizedName = typeof name === 'string' ? name.trim() : undefined
        const normalizedDescription = typeof description === 'string' ? description.trim() : description
        const archivedValue = typeof archived === 'boolean' ? archived : undefined
        const leadPayload = parseProjectLeadPayload(body)
        const leadIdsProvided = leadPayload.provided

        if (name !== undefined && !normalizedName) {
            return NextResponse.json({ error: 'Division name is required' }, { status: 400 })
        }

        const memberIdsInput = Array.isArray(memberIds)
            ? memberIds.filter((entry: unknown) => typeof entry === 'string' && entry.trim().length > 0)
            : undefined
        const uniqueMemberIds = memberIdsInput ? Array.from(new Set(memberIdsInput)) : undefined
        const normalizedLeadIds = leadPayload.leadIds
        const validLeadIds = leadIdsProvided
            ? await getWorkspaceUserIds(normalizedLeadIds, user.workspaceId)
            : undefined
        if (leadIdsProvided && validLeadIds && validLeadIds.length !== normalizedLeadIds.length) {
            return NextResponse.json({ error: 'One or more division leads are not in this workspace' }, { status: 400 })
        }

        const validMemberIds = uniqueMemberIds
            ? await getWorkspaceUserIds(uniqueMemberIds, user.workspaceId)
            : undefined
        if (uniqueMemberIds && validMemberIds && validMemberIds.length !== uniqueMemberIds.length) {
            return NextResponse.json({ error: 'One or more members are not in this workspace' }, { status: 400 })
        }

        let normalizedMemberIds = validMemberIds ? [...validMemberIds] : undefined
        if (leadIdsProvided) {
            const baseMemberIds = normalizedMemberIds || existingProject.members.map((member) => member.userId)
            normalizedMemberIds = mergeProjectMemberIds(baseMemberIds, validLeadIds || [])
        }

        const archivedAt = archivedValue === undefined
            ? undefined
            : archivedValue
                ? (existingProject.archivedAt ?? Date.now())
                : null

        const result = await updateWorkspaceProject({
            projectId: id,
            name: normalizedName,
            description: description !== undefined ? (normalizedDescription || null) : undefined,
            color: normalizeHexColor(color) ?? undefined,
            archivedAt,
            leadIds: leadIdsProvided ? (validLeadIds || []) : undefined,
            memberIds: normalizedMemberIds,
        })

        if ("error" in result) {
            const status = result.error === 'Division not found' ? 404 : 400
            return NextResponse.json({ error: result.error }, { status })
        }

        if (archivedValue !== undefined) {
            return NextResponse.json({
                success: true,
                archivedAt: result.project.archivedAt
                    ? new Date(result.project.archivedAt).toISOString()
                    : null,
            })
        }

        return NextResponse.json(serializeProjectDetail(result.project))
    } catch (error) {
        console.error('Failed to update project:', error)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.workspaceId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        if (user.role !== 'Admin' && user.role !== 'Team Lead') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { id } = await params

        let confirmName: string | undefined
        try {
            const body = await request.json()
            confirmName = body.confirmName
        } catch {
            // Backwards-compatible empty body.
        }

        const existingProject = await getWorkspaceProject(id, user.workspaceId)
        if (!existingProject) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const canDeleteAsLead = existingProject.leadIds.includes(user.id) || existingProject.leadId === user.id
        if (user.role === 'Team Lead' && !canDeleteAsLead) {
            return NextResponse.json({ error: 'Forbidden: You can only delete projects you lead' }, { status: 403 })
        }

        if (confirmName !== undefined && confirmName.trim() !== existingProject.name.trim()) {
            return NextResponse.json({ error: 'Division name does not match' }, { status: 400 })
        }

        const result = await deleteWorkspaceProject({
            projectId: id,
            workspaceId: user.workspaceId,
            deletedBy: user.id,
            deletedByName: user.name || 'Unknown',
        })

        if ("error" in result) {
            const status = result.error === 'Division not found' ? 404 : 400
            return NextResponse.json({ error: result.error }, { status })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete project:', error)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
