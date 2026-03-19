import { NextRequest, NextResponse } from "next/server"
import { api, createLegacyId, fetchMutation } from "@/lib/convex/server"
import { appendInviteNotice, isInviteStatus } from "@/lib/invite-status"
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/session"
import { isDevPreviewEnabled } from "@/lib/dev"

export const dynamic = "force-dynamic"

function getNotice(request: NextRequest) {
    const status = request.nextUrl.searchParams.get("status")
    if (!isInviteStatus(status)) {
        return null
    }

    const workspaceName = request.nextUrl.searchParams.get("workspace")?.trim()
    return {
        status,
        workspaceName: status === "invalid" ? null : workspaceName || "Project Atlas",
    }
}

export async function GET(request: NextRequest) {
    if (!isDevPreviewEnabled()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const screen = request.nextUrl.searchParams.get("screen") === "workspaces"
        ? "workspaces"
        : "onboarding"
    const displayName = request.nextUrl.searchParams.get("name")?.trim() || "Preview User"
    const interests = request.nextUrl.searchParams.get("interests")?.trim() || "Systems, robotics, and product design."
    const now = Date.now()

    const demoUser = await fetchMutation(api.auth.getOrCreateDemoUser, {
        userId: createLegacyId("user"),
        now,
    })

    await fetchMutation(api.auth.updateOnboardingProfile, {
        userId: demoUser.id,
        name: displayName,
        skills: [],
        interests,
        hasOnboarded: screen === "workspaces",
        updatedAt: now,
    })

    const session = await createSession(demoUser.id)
    const targetPath = appendInviteNotice(`/${screen}`, getNotice(request))
    const response = NextResponse.redirect(new URL(targetPath, request.url))

    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_TTL_SECONDS,
        path: "/",
    })

    response.cookies.set("discord_user", JSON.stringify({
        id: "preview-demo",
        username: "preview_user",
        discriminator: "0001",
        avatar: null,
        global_name: displayName,
    }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
    })

    return response
}
