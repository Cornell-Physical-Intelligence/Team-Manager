type ProjectLeadPayload = {
    leadIds?: unknown
    leadId?: unknown
}

function sanitizeLeadIds(values: unknown[]) {
    return Array.from(
        new Set(
            values
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter((value) => value.length > 0 && value !== "none")
        )
    )
}

export function parseProjectLeadPayload(payload: ProjectLeadPayload) {
    if (payload.leadIds !== undefined) {
        return {
            provided: true,
            leadIds: Array.isArray(payload.leadIds) ? sanitizeLeadIds(payload.leadIds) : []
        }
    }

    if (payload.leadId !== undefined) {
        if (payload.leadId === null) {
            return { provided: true, leadIds: [] }
        }

        return {
            provided: true,
            leadIds: sanitizeLeadIds([payload.leadId])
        }
    }

    return {
        provided: false,
        leadIds: [] as string[]
    }
}

export function getPrimaryProjectLeadId(leadIds: string[]) {
    return leadIds[0] || null
}

export function mergeProjectMemberIds(memberIds: string[] | undefined, leadIds: string[]) {
    return Array.from(new Set([...(memberIds || []), ...leadIds]))
}

export function mapProjectLeadUsers<TUser>(assignments: Array<{ user: TUser }> | null | undefined) {
    return (assignments || []).map((assignment) => assignment.user)
}
