import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { config as loadEnv } from "dotenv"

type TableExport = {
    name: string
    rows: unknown[]
}

const projectRoot = process.cwd()
loadEnv({ path: path.join(projectRoot, ".env.local"), override: true })
loadEnv({ path: path.join(projectRoot, ".env") })

function serializeForConvex(value: unknown): unknown {
    if (value instanceof Date) {
        return value.getTime()
    }

    if (value === null) {
        return undefined
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => serializeForConvex(item))
            .filter((item) => item !== undefined)
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).flatMap(([key, entry]) => {
                const serialized = serializeForConvex(entry)
                return serialized === undefined ? [] : [[key, serialized]]
            })
        )
    }

    return value
}

async function main() {
    const { default: prisma } = await import("../src/lib/prisma")
    const outputDir = path.resolve(process.cwd(), ".convex-export")

    const tables: TableExport[] = [
        { name: "users", rows: await prisma.user.findMany() },
        { name: "subteams", rows: await prisma.subteam.findMany() },
        { name: "projects", rows: await prisma.project.findMany() },
        { name: "projectLeadAssignments", rows: await prisma.projectLeadAssignment.findMany() },
        { name: "projectMembers", rows: await prisma.projectMember.findMany() },
        { name: "projectUserOrders", rows: await prisma.projectUserOrder.findMany() },
        { name: "pushes", rows: await prisma.push.findMany() },
        { name: "boards", rows: await prisma.board.findMany() },
        { name: "columns", rows: await prisma.column.findMany() },
        { name: "tasks", rows: await prisma.task.findMany() },
        { name: "taskDeletions", rows: await prisma.taskDeletion.findMany() },
        { name: "taskAssignees", rows: await prisma.taskAssignee.findMany() },
        { name: "comments", rows: await prisma.comment.findMany() },
        { name: "taskAttachments", rows: await prisma.taskAttachment.findMany() },
        { name: "taskChecklistItems", rows: await prisma.taskChecklistItem.findMany() },
        { name: "helpRequests", rows: await prisma.helpRequest.findMany() },
        { name: "activityLogs", rows: await prisma.activityLog.findMany() },
        { name: "invites", rows: await prisma.invite.findMany() },
        { name: "workspaceConfigs", rows: await prisma.workspaceConfig.findMany() },
        { name: "workspaces", rows: await prisma.workspace.findMany() },
        { name: "workspaceDriveConfigs", rows: await prisma.workspaceDriveConfig.findMany() },
        { name: "workloadConfigs", rows: await prisma.workloadConfig.findMany() },
        { name: "workspaceMembers", rows: await prisma.workspaceMember.findMany() },
        { name: "notifications", rows: await prisma.notification.findMany() },
        { name: "notificationReads", rows: await prisma.notificationRead.findMany() },
        { name: "generalChatMessages", rows: await prisma.generalChatMessage.findMany() },
        { name: "chatTypings", rows: await prisma.chatTyping.findMany() },
        { name: "sessions", rows: await prisma.session.findMany() },
    ]

    await rm(outputDir, { recursive: true, force: true })
    await mkdir(outputDir, { recursive: true })

    const manifest = tables.map(({ name, rows }) => ({ name, count: rows.length }))

    for (const { name, rows } of tables) {
        const content = rows
            .map((row) => JSON.stringify(serializeForConvex(row)))
            .join("\n")

        await writeFile(path.join(outputDir, `${name}.jsonl`), content ? `${content}\n` : "")
    }

    await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2))

    console.log(`Exported ${manifest.length} tables to ${outputDir}`)
    manifest.forEach((entry) => {
        console.log(`${entry.name}: ${entry.count}`)
    })

    await prisma.$disconnect()
}

main()
    .catch((error) => {
        console.error("Failed to export Prisma data for Convex:", error)
        process.exitCode = 1
    })
