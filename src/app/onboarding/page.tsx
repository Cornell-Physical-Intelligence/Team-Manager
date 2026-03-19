import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { readInviteNotice } from "@/lib/invite-status"
import { OnboardingCard } from "@/components/onboarding/OnboardingCard"

type SearchParams = Record<string, string | string[] | undefined>

export default async function OnboardingPage({
    searchParams,
}: {
    searchParams?: Promise<SearchParams>
}) {
    const cookieStore = await cookies()
    const discordUserCookie = cookieStore.get('discord_user')
    const user = await getCurrentUser()
    const inviteNotice = readInviteNotice(searchParams ? await searchParams : null)

    if (!user) {
        redirect('/')
    }

    if (user && user.hasOnboarded) {
        redirect('/workspaces')
    }

    if (!discordUserCookie) {
        redirect('/')
    }

    const discordUser = JSON.parse(discordUserCookie.value)

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-zinc-50 overflow-hidden p-4">

            {/* Dither/Noise Overlay */}
            <div
                className="fixed inset-0 z-10 pointer-events-none opacity-[0.12] mix-blend-multiply"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            <div className="relative z-20 w-full">
                <OnboardingCard
                    userId={user.id}
                    suggestedName={discordUser.global_name || discordUser.username}
                    discordUser={discordUser}
                    inviteNotice={inviteNotice}
                />
            </div>
        </div >
    )
}
