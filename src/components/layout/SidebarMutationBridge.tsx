"use client"

import { useEffect } from "react"
import { installSidebarMutationBridge } from "@/lib/sidebar-sync"

let activeBridgeCount = 0
let restoreBridge: (() => void) | null = null

export function SidebarMutationBridge() {
    useEffect(() => {
        activeBridgeCount += 1

        if (activeBridgeCount === 1) {
            restoreBridge = installSidebarMutationBridge()
        }

        return () => {
            activeBridgeCount -= 1

            if (activeBridgeCount === 0) {
                restoreBridge?.()
                restoreBridge = null
            }
        }
    }, [])

    return null
}
