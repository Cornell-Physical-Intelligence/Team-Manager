import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InviteNoticeCard } from "@/components/InviteNoticeCard"
import type { InviteNotice } from "@/lib/invite-status"
import { OnboardingForm, type OnboardingFormProps } from "@/app/onboarding/OnboardingForm"

export type OnboardingDiscordUser = {
    id: string
    username: string
    discriminator?: string | null
    avatar?: string | null
    global_name?: string | null
}

type OnboardingCardProps = {
    userId: string
    suggestedName: string
    discordUser: OnboardingDiscordUser
    inviteNotice: InviteNotice | null
    formProps?: Partial<OnboardingFormProps>
}

function getDiscordAvatarUrl(discordUser: OnboardingDiscordUser) {
    if (discordUser.avatar) {
        return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
    }

    return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || "0", 10) % 5}.png`
}

export function OnboardingCard({
    userId,
    suggestedName,
    discordUser,
    inviteNotice,
    formProps,
}: OnboardingCardProps) {
    const avatarUrl = getDiscordAvatarUrl(discordUser)
    const displayName = discordUser.global_name || discordUser.username

    return (
        <div className="w-full max-w-md space-y-4">
            {inviteNotice && <InviteNoticeCard notice={inviteNotice} />}

            <Card className="w-full shadow-xl border-zinc-200 bg-white/80 backdrop-blur-xl">
                <CardHeader className="text-center space-y-3 sm:space-y-4 pb-2 px-4 sm:px-6">
                    <div className="mx-auto relative">
                        <div className="absolute inset-0 bg-zinc-200 blur-xl rounded-full" />
                        <img
                            src={avatarUrl}
                            alt={discordUser.username}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white relative shadow-sm"
                        />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                            Welcome, {displayName}!
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base text-zinc-500">
                            Let&apos;s get your profile set up on CuPI. <span className="text-zinc-400 text-xs sm:text-sm block mt-1">(You can change these later)</span>
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <OnboardingForm
                        userId={userId}
                        suggestedName={suggestedName}
                        {...formProps}
                    />
                </CardContent>
            </Card>
        </div>
    )
}
