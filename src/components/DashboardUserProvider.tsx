"use client"

import { createContext, useContext } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/_generated/api"
import type { CurrentUser, CurrentUserRole } from "@/lib/auth"

export type DashboardUser = Pick<
    CurrentUser,
    "id" | "name" | "avatar" | "workspaceId" | "workspaceName"
> & {
    role: CurrentUserRole
}

const DashboardUserContext = createContext<DashboardUser | null>(null)

function resolveDashboardRole(
    workspaceId: string | null,
    membershipRole: string | null,
    fallbackRole: string
): CurrentUserRole {
    if (!workspaceId) {
        return fallbackRole === "Admin" || fallbackRole === "Team Lead" ? fallbackRole : "Member"
    }

    return membershipRole === "Admin" || membershipRole === "Team Lead" ? membershipRole : "Member"
}

export function DashboardUserProvider({
    user,
    children,
}: {
    user: DashboardUser
    children: React.ReactNode
}) {
    const managedUser = useQuery(
        api.admin.getManagedUser,
        user.workspaceId ? { workspaceId: user.workspaceId, userId: user.id } : "skip"
    )
    const resolvedUser: DashboardUser = managedUser
        ? {
            id: managedUser.user.id,
            name: managedUser.membership?.name || managedUser.user.name || user.name,
            avatar: managedUser.user.avatar ?? user.avatar,
            workspaceId: managedUser.user.workspaceId ?? user.workspaceId,
            workspaceName: user.workspaceName,
            role: resolveDashboardRole(
                managedUser.user.workspaceId ?? user.workspaceId,
                managedUser.membership?.role ?? null,
                managedUser.user.role
            ),
        }
        : user

    return (
        <DashboardUserContext.Provider value={resolvedUser}>
            {children}
        </DashboardUserContext.Provider>
    )
}

export function useDashboardUser() {
    return useContext(DashboardUserContext)
}
