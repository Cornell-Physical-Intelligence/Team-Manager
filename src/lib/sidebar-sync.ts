const SIDEBAR_SYNC_EVENT = "cupi:sidebar-sync"

let sidebarSyncQueued = false

function getRequestHeaders(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.headers) {
        return new Headers(init.headers)
    }

    if (input instanceof Request) {
        return new Headers(input.headers)
    }

    return new Headers()
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.method) {
        return init.method.toUpperCase()
    }

    if (input instanceof Request) {
        return input.method.toUpperCase()
    }

    return "GET"
}

function getRequestUrl(input: RequestInfo | URL) {
    if (typeof window === "undefined") return null

    if (typeof input === "string") {
        return new URL(input, window.location.origin)
    }

    if (input instanceof URL) {
        return new URL(input.toString(), window.location.origin)
    }

    return new URL(input.url, window.location.origin)
}

function isSidebarMutationRequest(input: RequestInfo | URL, init?: RequestInit) {
    const method = getRequestMethod(input, init)
    if (method === "GET" || method === "HEAD") {
        return false
    }

    const url = getRequestUrl(input)
    if (!url || url.origin !== window.location.origin || url.pathname.startsWith("/_next/")) {
        return false
    }

    const headers = getRequestHeaders(input, init)
    return url.pathname.startsWith("/api/") || headers.has("next-action")
}

export function requestSidebarSync() {
    if (typeof window === "undefined" || sidebarSyncQueued) return

    sidebarSyncQueued = true
    window.requestAnimationFrame(() => {
        sidebarSyncQueued = false
        window.dispatchEvent(new CustomEvent(SIDEBAR_SYNC_EVENT))
    })
}

export function subscribeSidebarSync(listener: () => void) {
    if (typeof window === "undefined") {
        return () => {}
    }

    const handler = () => listener()
    window.addEventListener(SIDEBAR_SYNC_EVENT, handler)

    return () => {
        window.removeEventListener(SIDEBAR_SYNC_EVENT, handler)
    }
}

export function installSidebarMutationBridge() {
    if (typeof window === "undefined") {
        return () => {}
    }

    const originalFetch = window.fetch.bind(window)

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await originalFetch(input, init)

        if (response.ok && isSidebarMutationRequest(input, init)) {
            requestSidebarSync()
        }

        return response
    }) as typeof window.fetch

    return () => {
        window.fetch = originalFetch
    }
}
