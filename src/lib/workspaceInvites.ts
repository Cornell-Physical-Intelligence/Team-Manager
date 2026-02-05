import prisma from "@/lib/prisma"

type JoinWorkspaceResult = {
    success?: true
    workspaceId?: string
    message?: string
    error?: string
}

export async function joinWorkspaceByCode({
    userId,
    userName,
    code,
}: {
    userId: string
    userName: string
    code: string
}): Promise<JoinWorkspaceResult> {
    const trimmed = code.trim()
    if (!trimmed) return { error: "Invite code is required" }

    let workspace = await prisma.workspace.findFirst({
        where: {
            OR: [{ inviteCode: trimmed }, { inviteCode: trimmed.toUpperCase() }],
        },
    })

    if (!workspace) {
        const invite = await prisma.invite.findUnique({
            where: { token: trimmed },
        })

        if (invite) {
            if (
                (invite.maxUses > 0 && invite.uses >= invite.maxUses) ||
                (invite.expiresAt && new Date() > invite.expiresAt)
            ) {
                return { error: "This invite code has expired or reached maximum uses" }
            }

            await prisma.invite.update({
                where: { id: invite.id },
                data: { uses: { increment: 1 } },
            })

            workspace = await prisma.workspace.findFirst({
                orderBy: { createdAt: "asc" },
            })
        }
    }

    if (!workspace) {
        return { error: "Invalid invite code" }
    }

    const existingMember = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
    })

    if (!existingMember) {
        await prisma.workspaceMember.create({
            data: {
                userId,
                workspaceId: workspace.id,
                role: "Member",
                name: userName,
            },
        })

        await prisma.notification.create({
            data: {
                workspaceId: workspace.id,
                userId: null,
                type: "member_joined",
                title: "New member joined",
                message: `${userName} has joined the workspace.`,
                link: "/dashboard/members",
            },
        })
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            workspaceId: workspace.id,
        },
    })

    return {
        success: true,
        workspaceId: workspace.id,
        message: existingMember
            ? `Welcome back! You are already a member of ${workspace.name}.`
            : undefined,
    }
}
