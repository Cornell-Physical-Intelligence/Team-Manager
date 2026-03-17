import { api, fetchQuery } from "@/lib/convex/server"

export async function getLeanProjectTasks(projectId: string, pushId?: string | null) {
    return fetchQuery(api.tasks.getLeanProjectTasks, {
        projectId,
        pushId: pushId === undefined ? undefined : pushId,
    })
}
