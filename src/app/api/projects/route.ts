import { NextResponse } from 'next/server'
// Force rebuild
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getWorkspaceUserIds } from '@/lib/access'
import { getErrorCode, getErrorMessage } from '@/lib/errors'
import {
    getPrimaryProjectLeadId,
    mapProjectLeadUsers,
    mergeProjectMemberIds,
    parseProjectLeadPayload,
} from '@/lib/project-leads'

const PROJECT_COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#f59e0b", // amber
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
]

const PUSH_COLORS = [
    "#3b82f6", // blue
    "#22c55e", // green
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16", // lime
]

function normalizeHexColor(value: unknown): string | null {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed) return null
    const hex = trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/.test(hex) ? hex : null
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

        const projects = await prisma.project.findMany({
            where: {
                workspaceId: user.workspaceId,
                ...(includeArchived ? {} : { archivedAt: null })
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                description: true,
                color: true,
                archivedAt: true,
                createdAt: true,
                leadId: includeLead,
                lead: includeLead ? { select: { id: true, name: true } } : false,
                leadAssignments: includeLead
                    ? {
                        orderBy: { createdAt: 'asc' },
                        select: { user: { select: { id: true, name: true } } }
                    }
                    : false,
                members: { select: { userId: true, user: { select: { name: true } } } }
            }
        })

        const userOrders = await prisma.projectUserOrder.findMany({
            where: { userId: user.id, projectId: { in: projects.map(p => p.id) } },
            select: { projectId: true, order: true },
        })
        const orderMap = new Map(userOrders.map(o => [o.projectId, o.order]))

        const sorted = [...projects].sort((a, b) => {
            const aOrder = orderMap.get(a.id)
            const bOrder = orderMap.get(b.id)
            const aHas = aOrder !== undefined
            const bHas = bOrder !== undefined
            if (aHas && bHas) return aOrder! - bOrder!
            if (aHas) return -1
            if (bHas) return 1
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        if (!includeLead) {
            return NextResponse.json(sorted)
        }

        const serialized = sorted.map((project) => {
            const { leadAssignments, ...rest } = project
            const leads = mapProjectLeadUsers(
                leadAssignments as unknown as Array<{ user: { id: string; name: string } }>
            )
            const leadIds = leads.map((lead) => lead.id)
            const primaryLeadId = getPrimaryProjectLeadId(leadIds) ?? rest.leadId ?? null
            const primaryLead = rest.lead ?? leads[0] ?? null

            return {
                ...rest,
                leadId: primaryLeadId,
                lead: primaryLead,
                leadIds,
                leads
            }
        })

        return NextResponse.json(serialized)
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

        const memberIdsToPersist = mergeProjectMemberIds(validMemberIds, validLeadIds)
        const primaryLeadId = getPrimaryProjectLeadId(validLeadIds)

        // Create division with default board and columns
        const project = await prisma.$transaction(async (tx) => {
            const normalizedColor = normalizeHexColor(color)
            const generatedColor = normalizedColor
                ? normalizedColor
                : PROJECT_COLORS[
                (await tx.project.count({ where: { workspaceId: user.workspaceId } })) % PROJECT_COLORS.length
                ]

            const p = await tx.project.create({
                data: {
                    name,
                    description: description || null,
                    color: generatedColor,
                    leadId: primaryLeadId,
                    workspaceId: user.workspaceId
                }
            })

            if (validLeadIds.length > 0) {
                await tx.projectLeadAssignment.createMany({
                    data: validLeadIds.map((userId) => ({
                        projectId: p.id,
                        userId
                    }))
                })
            }

            if (memberIdsToPersist.length > 0) {
                await tx.projectMember.createMany({
                    data: memberIdsToPersist.map((userId) => ({
                        projectId: p.id,
                        userId
                    }))
                })
            }

            await tx.board.create({
                data: {
                    name: 'Kanban Board',
                    projectId: p.id,
                    columns: {
                        create: [
                            { name: 'To Do', order: 0 },
                            { name: 'In Progress', order: 1 },
                            { name: 'Review', order: 2 },
                            { name: 'Done', order: 3 },
                        ]
                    }
                }
            })

            // Create pushes if provided
            if (pushes && Array.isArray(pushes) && pushes.length > 0) {
                // First pass: create all pushes and build tempId -> realId mapping
                const tempIdToRealId = new Map<string, string>()

                for (let i = 0; i < pushes.length; i++) {
                    const push = pushes[i]
                    if (push.name && push.startDate) {
                        const createdPush = await tx.push.create({
                            data: {
                                name: push.name,
                                projectId: p.id,
                                startDate: new Date(push.startDate),
                                endDate: push.endDate ? new Date(push.endDate) : null,
                                color: push.color || PUSH_COLORS[i % PUSH_COLORS.length],
                                status: 'Active'
                            }
                        })
                        if (push.tempId) {
                            tempIdToRealId.set(push.tempId, createdPush.id)
                        }
                    }
                }

                // Second pass: update dependencies
                for (const push of pushes) {
                    if (push.dependsOn && push.tempId) {
                        const realId = tempIdToRealId.get(push.tempId)
                        const dependsOnRealId = tempIdToRealId.get(push.dependsOn)
                        if (realId && dependsOnRealId) {
                            await tx.push.update({
                                where: { id: realId },
                                data: { dependsOnId: dependsOnRealId }
                            })
                        }
                    }
                }
            }

            return p
        })

        return NextResponse.json(project, { status: 201 })
    } catch (error: unknown) {
        console.error('[API] Failed to create division:', error)
        const code = getErrorCode(error)
        if (code) console.error('[API] Error Code:', code)

        return NextResponse.json({
            error: getErrorMessage(error, 'Failed to create division'),
            details: code || undefined
        }, { status: 500 })
    }
}
