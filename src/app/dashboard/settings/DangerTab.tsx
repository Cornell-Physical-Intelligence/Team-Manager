"use client"

import { DeleteWorkspace } from "./DeleteWorkspace"

type DangerTabProps = {
    workspaceId: string
    workspaceName: string
}

export function DangerTab({ workspaceId, workspaceName }: DangerTabProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
                <p className="text-xs text-muted-foreground mt-1">Irreversible actions for your workspace.</p>
            </div>

            <DeleteWorkspace workspaceId={workspaceId} workspaceName={workspaceName} />
        </div>
    )
}
