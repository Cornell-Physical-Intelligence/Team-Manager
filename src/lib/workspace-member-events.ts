export const WORKSPACE_MEMBERS_UPDATED_EVENT = "cupi:workspace-members-updated"

export function dispatchWorkspaceMembersUpdated() {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent(WORKSPACE_MEMBERS_UPDATED_EVENT))
}

export function subscribeWorkspaceMembersUpdated(listener: () => void) {
    if (typeof window === "undefined") {
        return () => {}
    }

    const handler = () => listener()
    window.addEventListener(WORKSPACE_MEMBERS_UPDATED_EVENT, handler)

    return () => {
        window.removeEventListener(WORKSPACE_MEMBERS_UPDATED_EVENT, handler)
    }
}
