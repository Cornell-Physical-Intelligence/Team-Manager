"use client"

type PrefetchRouter = {
    prefetch: (href: string) => void
}

type LeanTaskCachePayload<T> = {
    ts: number
    tasks: T[]
}

export const LEAN_TASK_CACHE_TTL_MS = 10 * 60 * 1000

const pendingLeanTaskPrefetches = new Map<string, Promise<void>>()

export function getLeanTaskCacheKey(projectId: string) {
    return `cupi:leanTasks:${projectId}`
}

export function readLeanTaskCache<T>(projectId: string) {
    if (typeof window === "undefined") return null

    try {
        const raw = window.sessionStorage.getItem(getLeanTaskCacheKey(projectId))
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<LeanTaskCachePayload<T>>
        if (!Array.isArray(parsed.tasks)) return null
        if (typeof parsed.ts !== "number") return null
        if (Date.now() - parsed.ts > LEAN_TASK_CACHE_TTL_MS) return null

        return parsed.tasks
    } catch {
        return null
    }
}

export function isLeanTaskCacheFresh(projectId: string) {
    return readLeanTaskCache(projectId) !== null
}

export function writeLeanTaskCache<T>(projectId: string, tasks: T[]) {
    if (typeof window === "undefined") return

    try {
        const payload: LeanTaskCachePayload<T> = {
            ts: Date.now(),
            tasks,
        }

        window.sessionStorage.setItem(getLeanTaskCacheKey(projectId), JSON.stringify(payload))
    } catch {
        // ignore storage write failures
    }
}

export function prefetchProjectRoute(projectId: string, router: PrefetchRouter) {
    router.prefetch(`/dashboard/projects/${projectId}`)
}

export function prefetchLeanTasks(projectId: string) {
    if (typeof window === "undefined" || isLeanTaskCacheFresh(projectId)) {
        return Promise.resolve()
    }

    const existing = pendingLeanTaskPrefetches.get(projectId)
    if (existing) return existing

    const task = (async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/tasks?lean=true`)
            const data = await res.json()
            if (!res.ok || !Array.isArray(data?.tasks)) return

            writeLeanTaskCache(projectId, data.tasks)
        } catch {
            // ignore prefetch failures
        } finally {
            pendingLeanTaskPrefetches.delete(projectId)
        }
    })()

    pendingLeanTaskPrefetches.set(projectId, task)
    return task
}
