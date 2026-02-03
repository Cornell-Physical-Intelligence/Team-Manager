"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react"
import { DisplayNameSettings } from "./DisplayNameSettings"
import { AppearanceSettings } from "./AppearanceSettings"
import { CopyButton } from "./CopyButton"
import { WorkloadSettings } from "./WorkloadSettings"

type GeneralTabProps = {
    userName: string
    userId: string
    userRole: string
    inviteCode: string | null
    showWorkload: boolean
}

export function GeneralTab({ userName, userId, userRole, inviteCode, showWorkload }: GeneralTabProps) {
    const [workloadOpen, setWorkloadOpen] = useState(false)

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">General</h2>
                <p className="text-xs text-muted-foreground mt-1">Your profile and preferences.</p>
            </div>

            <div className="space-y-5 max-w-md">
                <DisplayNameSettings initialName={userName} />
                <AppearanceSettings userId={userId} />

                <div className="grid gap-2">
                    <Label className="text-sm">Role</Label>
                    <Input defaultValue={userRole} disabled className="bg-muted h-9 text-sm" />
                </div>

                {inviteCode && (
                    <div className="grid gap-2">
                        <Label className="text-sm">Invite Code</Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-muted/50 border rounded-md font-mono text-sm tracking-widest text-center select-all">
                                {inviteCode}
                            </code>
                            <CopyButton text={inviteCode} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Share this code to allow others to join your workspace.
                        </p>
                    </div>
                )}
            </div>

            {showWorkload && (
                <div className="space-y-3">
                    <div>
                        <h3 className="text-sm font-semibold">Workload Scoring</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Configure how team member status is computed on the heatmap.
                        </p>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <button
                            onClick={() => setWorkloadOpen(!workloadOpen)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                        >
                            <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">Advanced Scoring Configuration</p>
                                <p className="text-xs text-muted-foreground">Thresholds, weights, capacity, and baseline settings</p>
                            </div>
                            {workloadOpen ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                        </button>
                        {workloadOpen && (
                            <div className="border-t px-4 py-4">
                                <WorkloadSettings />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
