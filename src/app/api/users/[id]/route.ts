import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser || !currentUser.workspaceId) {
            return NextResponse.json({ error: "Unauthorized: Not authenticated" }, { status: 401 })
        }

        if (currentUser.role !== "Admin" && currentUser.role !== "Team Lead") {
            return NextResponse.json({ error: "Unauthorized: Only Admins and Team Leads can change members" }, { status: 403 })
        }

        const { id: userId } = await params
        const body = await request.json().catch(() => null)
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        const payload = body as { name?: unknown; role?: unknown; projectIds?: unknown }
        const workspaceId = currentUser.workspaceId
        const nextName = typeof payload.name === "string" ? payload.name.trim() : undefined
        const nextRole = typeof payload.role === "string" ? payload.role : undefined
        const nextProjectIds = Array.isArray(payload.projectIds)
            ? Array.from(
                new Set(
                    payload.projectIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
                )
            )
            : undefined

        if (nextName === undefined && nextRole === undefined && nextProjectIds === undefined) {
            return NextResponse.json({ error: "No member changes were provided" }, { status: 400 })
        }

        if (nextName !== undefined && (!nextName || nextName.length > 50)) {
            return NextResponse.json({ error: "Invalid name" }, { status: 400 })
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, workspaceId: true, name: true }
        })

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const targetMembership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
            select: { role: true, name: true }
        })

        const isMember = Boolean(targetMembership) || targetUser.workspaceId === workspaceId
        if (!isMember) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        if (nextRole !== undefined) {
            const validRoles = ["Admin", "Team Lead", "Member"]
            if (!validRoles.includes(nextRole)) {
                return NextResponse.json({ error: "Invalid role" }, { status: 400 })
            }

            const targetRole = targetMembership?.role ?? (targetUser.workspaceId === workspaceId ? targetUser.role : null)

            if (targetRole === "Admin" && currentUser.role !== "Admin") {
                return NextResponse.json({ error: "Unauthorized: Only Admins can modify other Admins" }, { status: 403 })
            }

            if (nextRole === "Admin" && currentUser.role !== "Admin") {
                return NextResponse.json({ error: "Unauthorized: Only Admins can promote users to Admin" }, { status: 403 })
            }

            if (currentUser.id === userId && nextRole !== "Admin") {
                const adminCount = await prisma.workspaceMember.count({
                    where: { role: "Admin", workspaceId }
                })

                if (adminCount <= 1) {
                    return NextResponse.json({
                        error: "Cannot remove your admin role: You are the only admin. Please assign another admin first.",
                        requiresAdminAssignment: true,
                    }, { status: 400 })
                }
            }
        }

        if (nextProjectIds !== undefined) {
            const workspaceProjects = await prisma.project.findMany({
                where: {
                    workspaceId,
                    archivedAt: null,
                    id: { in: nextProjectIds }
                },
                select: { id: true }
            })

            if (workspaceProjects.length !== nextProjectIds.length) {
                return NextResponse.json({ error: "One or more projects are not in this workspace" }, { status: 400 })
            }
        }

        await prisma.$transaction(async (tx) => {
            if (nextRole !== undefined) {
                const membership = await tx.workspaceMember.findUnique({
                    where: { userId_workspaceId: { userId, workspaceId } },
                    select: { id: true }
                })

                if (membership) {
                    await tx.workspaceMember.update({
                        where: { userId_workspaceId: { userId, workspaceId } },
                        data: { role: nextRole }
                    })
                } else if (targetUser.workspaceId === workspaceId) {
                    await tx.workspaceMember.create({
                        data: {
                            userId,
                            workspaceId,
                            role: nextRole,
                            name: targetUser.name || "User"
                        }
                    })
                }
            }

            if (nextName !== undefined) {
                await tx.workspaceMember.updateMany({
                    where: { userId, workspaceId },
                    data: { name: nextName }
                })
            }

            if (nextProjectIds !== undefined) {
                await tx.projectMember.deleteMany({
                    where: {
                        userId,
                        project: { workspaceId, archivedAt: null }
                    }
                })

                if (nextProjectIds.length > 0) {
                    await tx.projectMember.createMany({
                        data: nextProjectIds.map((projectId) => ({
                            userId,
                            projectId
                        }))
                    })
                }
            }
        })

        revalidatePath("/dashboard")
        revalidatePath("/dashboard/settings")
        revalidatePath("/dashboard/members")
        revalidatePath("/dashboard/projects")

        return NextResponse.json({
            success: true,
            user: {
                id: userId,
                name: nextName ?? targetMembership?.name ?? targetUser.name,
                role: nextRole ?? targetMembership?.role ?? targetUser.role,
                projectIds: nextProjectIds,
            },
        })
    } catch (error) {
        console.error("[PATCH /api/users/[id]] Error:", error)
        return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
    }
}
