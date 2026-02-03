"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react"
import { WorkloadSettings } from "./WorkloadSettings"

export function WorkloadTab() {
    const [open, setOpen] = useState(false)

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Workload</h2>
                <p className="text-xs text-muted-foreground mt-1">Configure how team member status is computed on the heatmap.</p>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <button
                    onClick={() => setOpen(!open)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                    <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Advanced Scoring Configuration</p>
                        <p className="text-xs text-muted-foreground">Thresholds, weights, capacity, and baseline settings</p>
                    </div>
                    {open ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                </button>
                {open && (
                    <div className="border-t px-4 py-4">
                        <WorkloadSettings />
                    </div>
                )}
            </div>
        </div>
    )
}
