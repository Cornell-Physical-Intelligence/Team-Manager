"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyButton } from "@/components/CopyButton"
import { DisplayNameSettings } from "./DisplayNameSettings"
import { AppearanceSettings } from "./AppearanceSettings"

type GeneralTabProps = {
    userName: string
    userId: string
    userRole: string
    inviteCode: string | null
    inviteLink: string | null
}

export function GeneralTab({ userName, userId, userRole, inviteCode, inviteLink }: GeneralTabProps) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold">General</h2>
                <p className="text-xs text-muted-foreground mt-1">Your profile and preferences.</p>
            </div>

            <div className="space-y-5 max-w-md">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] items-end">
                    <DisplayNameSettings initialName={userName} />
                    <span className="text-xs text-muted-foreground sm:pb-2">
                        {userRole}
                    </span>
                </div>

                <AppearanceSettings userId={userId} />

                {inviteLink && (
                    <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm">Invite Link</Label>
                            <span className="text-[11px] text-muted-foreground">Anyone with link can join.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                value={inviteLink}
                                readOnly
                                className="h-9 text-xs bg-muted/50"
                            />
                            <CopyButton text={inviteLink} />
                        </div>
                    </div>
                )}

                {inviteCode && (
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
                )}
            </div>
        </div>
    )
}
