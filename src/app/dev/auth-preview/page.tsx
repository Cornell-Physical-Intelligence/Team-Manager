import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/CopyButton"
import { OnboardingCard } from "@/components/onboarding/OnboardingCard"
import { isInviteStatus, type InviteNotice } from "@/lib/invite-status"
import { isDevPreviewEnabled } from "@/lib/dev"
import { getAppBaseUrl } from "@/lib/appUrl"

export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

function getOnboardingPreset(view: string | undefined) {
    switch (view) {
        case "step-2":
            return { initialStep: 2 as const }
        case "name-error":
            return {
                initialStep: 1 as const,
                initialError: "Please enter your full name (First and Last name)",
                initialName: "Preview",
            }
        case "interest-error":
            return {
                initialStep: 2 as const,
                initialError: "Please tell us a bit about your interests",
            }
        case "submitting":
            return {
                initialStep: 2 as const,
                previewSubmitting: true,
            }
        default:
            return { initialStep: 1 as const }
    }
}

function createPreviewHref(params: URLSearchParams, patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)

    for (const [key, value] of Object.entries(patch)) {
        if (value === null) {
            next.delete(key)
        } else {
            next.set(key, value)
        }
    }

    const query = next.toString()
    return query ? `/dev/auth-preview?${query}` : "/dev/auth-preview"
}

function createLaunchHref(screen: "onboarding" | "workspaces", noticeStatus: string | null, workspaceName: string) {
    const params = new URLSearchParams({ screen })

    if (noticeStatus) {
        params.set("status", noticeStatus)
    }

    if (noticeStatus && noticeStatus !== "invalid") {
        params.set("workspace", workspaceName)
    }

    return `/api/dev/auth-preview?${params.toString()}`
}

export default async function AuthPreviewPage({
    searchParams,
}: {
    searchParams?: Promise<SearchParams>
}) {
    if (!isDevPreviewEnabled()) {
        notFound()
    }

    const params = new URLSearchParams()
    const resolved = searchParams ? await searchParams : undefined

    for (const [key, value] of Object.entries(resolved || {})) {
        const first = firstValue(value)
        if (first) {
            params.set(key, first)
        }
    }

    const view = params.get("view") || "base"
    const workspaceName = params.get("workspace")?.trim() || "Project Atlas"
    const noticeStatus = params.get("status")
    const inviteNotice: InviteNotice | null = isInviteStatus(noticeStatus)
        ? {
            status: noticeStatus,
            workspaceName: noticeStatus === "invalid" ? null : workspaceName,
        }
        : null

    const onboardingPreset = getOnboardingPreset(view)
    const inviteCode = workspaceName === "Project Atlas" ? "ATLAS7" : "PREVIEW"
    const inviteLink = `${getAppBaseUrl()}/invite/${inviteCode}`

    return (
        <div className="min-h-screen bg-zinc-50 p-4 md:p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Auth UI Preview</h1>
                    <p className="text-sm text-zinc-500">
                        Launch the real onboarding or workspace routes locally, or inspect the full onboarding and invite-link UI in one place.
                    </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                    <OnboardingCard
                        userId="preview-user"
                        suggestedName=""
                        discordUser={{
                            id: "preview-user",
                            username: "new_member",
                            discriminator: "0001",
                            avatar: null,
                            global_name: null,
                        }}
                        inviteNotice={inviteNotice}
                        formProps={{
                            previewMode: true,
                            initialName: onboardingPreset.initialName,
                            initialStep: onboardingPreset.initialStep,
                            initialError: onboardingPreset.initialError,
                            previewSubmitting: onboardingPreset.previewSubmitting,
                            initialInterests: "Robotics autonomy, ML infra, and product build-out.",
                        }}
                    />

                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Preview States</CardTitle>
                                <CardDescription>Use these presets to inspect every onboarding and invite UI state.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    <Button asChild variant={view === "base" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { view: "base" })}>Base</Link></Button>
                                    <Button asChild variant={view === "step-2" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { view: "step-2" })}>Step 2</Link></Button>
                                    <Button asChild variant={view === "name-error" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { view: "name-error" })}>Name Error</Link></Button>
                                    <Button asChild variant={view === "interest-error" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { view: "interest-error" })}>Interest Error</Link></Button>
                                    <Button asChild variant={view === "submitting" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { view: "submitting" })}>Submitting</Link></Button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button asChild variant={!inviteNotice ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { status: null })}>No Invite Banner</Link></Button>
                                    <Button asChild variant={noticeStatus === "joined" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { status: "joined" })}>Joined</Link></Button>
                                    <Button asChild variant={noticeStatus === "already-member" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { status: "already-member" })}>Already Member</Link></Button>
                                    <Button asChild variant={noticeStatus === "invalid" ? "default" : "outline"} size="sm"><Link href={createPreviewHref(params, { status: "invalid" })}>Invalid</Link></Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Launch Real Routes</CardTitle>
                                <CardDescription>These buttons create a local preview session and open the actual app routes.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-2">
                                <Button asChild className="w-full" variant="outline">
                                    <Link href={createLaunchHref("onboarding", noticeStatus, workspaceName)}>Open real onboarding</Link>
                                </Button>
                                <Button asChild className="w-full" variant="outline">
                                    <Link href={createLaunchHref("workspaces", noticeStatus, workspaceName)}>Open workspace hub</Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Invite Link UI</CardTitle>
                                <CardDescription>The same read-only invite affordances used in settings.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 max-w-xl">
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label className="text-sm">Invite Link</Label>
                                        <span className="text-[11px] text-muted-foreground">Anyone with link can join.</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input value={inviteLink} readOnly className="h-9 text-xs bg-muted/50" />
                                        <CopyButton text={inviteLink} />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label className="text-sm">Invite Code</Label>
                                        <span className="text-[11px] text-muted-foreground">Share with members.</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 px-3 py-2 bg-muted/50 border rounded-md font-mono text-sm tracking-widest text-center select-all">
                                            {inviteCode}
                                        </code>
                                        <CopyButton text={inviteCode} />
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Preview route: <span className="font-mono text-[11px]">/dev/auth-preview</span>
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
