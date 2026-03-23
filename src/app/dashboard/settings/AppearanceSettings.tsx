"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
    applyThemePreference,
    persistThemePreference,
    readThemePreference,
    type ThemePreference,
} from "@/components/ThemeClient"

export function AppearanceSettings({ userId }: { userId: string }) {
    const [preference, setPreference] = useState<ThemePreference>("light")

    useEffect(() => {
        const pref = readThemePreference(userId)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync stored preference when the scoped user changes
        setPreference(pref)
        applyThemePreference(pref)
    }, [userId])

    const setAndPersist = (next: ThemePreference) => {
        setPreference(next)
        applyThemePreference(next)
        try {
            persistThemePreference(next, userId)
        } catch {
            // ignore
        }
    }

    return (
        <div className="grid gap-2">
            <Label>Appearance</Label>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant={preference === "light" ? "secondary" : "outline"}
                    size="sm"
                    className={cn("gap-2", preference === "light" && "ring-1 ring-border")}
                    onClick={() => setAndPersist("light")}
                >
                    <Sun className="h-4 w-4" />
                    Light
                </Button>
                <Button
                    type="button"
                    variant={preference === "dark" ? "secondary" : "outline"}
                    size="sm"
                    className={cn("gap-2", preference === "dark" && "ring-1 ring-border")}
                    onClick={() => setAndPersist("dark")}
                >
                    <Moon className="h-4 w-4" />
                    Dark
                </Button>
            </div>
        </div>
    )
}
