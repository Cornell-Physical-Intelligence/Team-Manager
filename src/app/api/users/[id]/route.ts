import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/auth"
import { api, fetchMutation, fetchQuery } from "@/lib/convex/server"

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

        const managedUser = await fetchQuery(api.admin.getManagedUser, {
            workspaceId,
            userId,
        })

        if (!managedUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }
        const targetUser = managedUser.user
        const targetMembership = managedUser.membership

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
                const adminCount = await fetchQuery(api.admin.countWorkspaceAdmins, { workspaceId })

                if (adminCount <= 1) {
                    return NextResponse.json({
                        error: "Cannot remove your admin role: You are the only admin. Please assign another admin first.",
                        requiresAdminAssignment: true,
                    }, { status: 400 })
                }
            }
        }

        if (nextProjectIds !== undefined) {
            const validProjectIds = await fetchQuery(api.admin.validateActiveProjectIds, {
                workspaceId,
                projectIds: nextProjectIds,
            })

            if (validProjectIds.length !== nextProjectIds.length) {
                return NextResponse.json({ error: "One or more projects are not in this workspace" }, { status: 400 })
            }
        }

        if (nextRole !== undefined) {
            const roleResult = await fetchMutation(api.admin.setWorkspaceMemberRole, {
                workspaceId,
                userId,
                role: nextRole,
                fallbackName: targetUser.name || "User",
            })

            if ('error' in roleResult) {
                return NextResponse.json({ error: "User not found" }, { status: 404 })
            }
        }

        if (nextName !== undefined) {
            const nameResult = await fetchMutation(api.admin.updateWorkspaceMemberName, {
                workspaceId,
                userId,
                name: nextName,
            })

            if ('error' in nameResult) {
                return NextResponse.json({ error: "User not found" }, { status: 404 })
            }
        }

        if (nextProjectIds !== undefined) {
            await fetchMutation(api.admin.replaceUserProjectMemberships, {
                workspaceId,
                userId,
                projectIds: nextProjectIds,
            })
        }

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
                projectIds: nextProjectIds ?? managedUser.activeProjectIds,
            },
        })
    } catch (error) {
        console.error("[PATCH /api/users/[id]] Error:", error)
        return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
    }
}
