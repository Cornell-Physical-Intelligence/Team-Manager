"use client"

import { useEffect } from "react"

export type ThemePreference = "light" | "dark"

const ROOT_THEME_KEY = "cupi_theme"

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
    return value === "dark" ? "dark" : "light"
}

export function applyThemePreference(pref: ThemePreference) {
    const root = document.documentElement
    root.dataset.theme = pref

    const isDark = pref === "dark"
    root.classList.toggle("dark", isDark)
    root.style.colorScheme = isDark ? "dark" : "light"
}

export function persistThemePreference(pref: ThemePreference, userId?: string | null) {
    window.localStorage.setItem(ROOT_THEME_KEY, pref)
    if (userId) {
        window.localStorage.setItem(`cupi_theme:${userId}`, pref)
    }
}

export function readThemePreference(userId?: string | null): ThemePreference {
    const userKey = userId ? `cupi_theme:${userId}` : null

    try {
        const userPref = userKey ? window.localStorage.getItem(userKey) : null
        const rootPref = window.localStorage.getItem(ROOT_THEME_KEY)
        const pref = normalizeThemePreference(userPref || rootPref)

        if (rootPref !== pref) {
            window.localStorage.setItem(ROOT_THEME_KEY, pref)
        }
        if (userKey && userPref !== pref) {
            window.localStorage.setItem(userKey, pref)
        }

        return pref
    } catch {
        return "light"
    }
}

export function ThemeClient({ userId }: { userId?: string | null }) {
    useEffect(() => {
        const pref = readThemePreference(userId)
        applyThemePreference(pref)
    }, [userId])

    return null
}
