import { fetchMutation, fetchQuery } from "convex/nextjs"
import { api } from "@convex/_generated/api"

export { api, fetchMutation, fetchQuery }

export function createLegacyId(prefix: string) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
}
