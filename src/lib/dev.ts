export function isDevPreviewEnabled() {
    if (process.env.NODE_ENV !== "production") {
        return true
    }

    const flag = process.env.ENABLE_DEMO_MODE?.trim().toLowerCase()
    return flag === "1" || flag === "true" || flag === "yes"
}
