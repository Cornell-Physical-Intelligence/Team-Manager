import { api, fetchQuery } from "@/lib/convex/server"

export function fetchDashboardPageData(args: {
    userId: string
    workspaceId: string
    role: string
}) {
    return fetchQuery(api.dashboard.getDashboardPageData, args)
}

export function fetchDashboardProjectsTarget(args: {
    userId: string
    workspaceId: string
    role: string
}) {
    return fetchQuery(api.dashboard.getProjectsPageTarget, args)
}

export function fetchDashboardMembersPageData(args: {
    workspaceId: string
}) {
    return fetchQuery(api.dashboard.getMembersPageData, args)
}

export function fetchDashboardMyBoardPageData(args: {
    userId: string
    workspaceId: string
}) {
    return fetchQuery(api.dashboard.getMyBoardPageData, args)
}

export function fetchDashboardHeatmapPageData(args: {
    workspaceId: string
}) {
    return fetchQuery(api.dashboard.getHeatmapPageData, args)
}

export function fetchHeatmapWidgetData(args: {
    workspaceId: string
}) {
    return fetchQuery(api.dashboard.getHeatmapWidgetData, args)
}
