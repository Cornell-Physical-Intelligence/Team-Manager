import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUser } from "@/lib/auth"
import { joinWorkspaceByCode } from "@/lib/workspaceInvites"

export const dynamic = "force-dynamic"

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ code: string }> }
) {
    const { code } = await context.params
    const trimmedCode = code?.trim()
    if (!trimmedCode) {
        return NextResponse.redirect(new URL("/workspaces", request.url))
    }

    const user = await getCurrentUser()
    const cookieStore = await cookies()

    if (!user || user.id === "pending") {
        cookieStore.set("pending_invite", trimmedCode, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 10,
            path: "/",
        })
        return NextResponse.redirect(new URL("/api/discord/login", request.url))
    }

    const result = await joinWorkspaceByCode({
        userId: user.id,
        userName: user.name,
        code: trimmedCode,
    })

    if (result.error) {
        return NextResponse.redirect(new URL("/workspaces?invite=invalid", request.url))
    }

    return NextResponse.redirect(new URL("/dashboard", request.url))
}
