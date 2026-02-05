import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUser } from "@/lib/auth"
import { joinWorkspaceByCode } from "@/lib/workspaceInvites"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: { code: string } }) {
    const code = params.code?.trim()
    if (!code) {
        return NextResponse.redirect(new URL("/workspaces", request.url))
    }

    const user = await getCurrentUser()
    const cookieStore = await cookies()

    if (!user || user.id === "pending") {
        cookieStore.set("pending_invite", code, {
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
        code,
    })

    if (result.error) {
        return NextResponse.redirect(new URL("/workspaces?invite=invalid", request.url))
    }

    return NextResponse.redirect(new URL("/dashboard", request.url))
}
