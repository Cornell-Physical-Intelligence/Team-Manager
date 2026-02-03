"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
    ArrowLeft,
    Check,
    ChevronRight,
    FolderOpen,
    Loader2,
    XCircle,
} from "lucide-react"
import { DiscordChannelSettings } from "./DiscordChannelSettings"

type DriveConfig = {
    connected: boolean
    folderId: string | null
    folderName: string | null
    connectedByName: string | null
}

type FolderOption = { id: string; name: string; modifiedTime?: string | null }
type BreadcrumbEntry = { id: string; name: string }

function GoogleDriveLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
        </svg>
    )
}

function DriveCard({ config, canManage }: { config: DriveConfig; canManage: boolean }) {
    const [connecting, setConnecting] = useState(false)
    const [disconnecting, setDisconnecting] = useState(false)
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

    // Root folder picker state
    const [pickingFolder, setPickingFolder] = useState(false)
    const [currentFolder, setCurrentFolder] = useState<BreadcrumbEntry | null>(null)
    const [folderStack, setFolderStack] = useState<BreadcrumbEntry[]>([])
    const [folders, setFolders] = useState<FolderOption[]>([])
    const [loadingFolders, setLoadingFolders] = useState(false)
    const [savedFolder, setSavedFolder] = useState<BreadcrumbEntry | null>(
        config.folderId && config.folderName ? { id: config.folderId, name: config.folderName } : null
    )

    const setMessage = (type: "success" | "error", message: string) => {
        setStatus({ type, message })
        setTimeout(() => setStatus(null), 4000)
    }

    const handleConnect = () => {
        setConnecting(true)
        window.location.href = "/api/google-drive/login"
    }

    const handleDisconnect = async () => {
        setDisconnecting(true)
        try {
            const res = await fetch("/api/google-drive/disconnect", { method: "POST" })
            if (!res.ok) throw new Error("Failed to disconnect")
            window.location.reload()
        } catch {
            setMessage("error", "Could not disconnect. Try again.")
            setDisconnecting(false)
        }
    }

    const cleanFolders = (list: FolderOption[]) =>
        list.filter((f) => {
            const t = f.name.trim()
            return t && !t.startsWith(".") && !/^\d+$/.test(t)
        })

    const loadFolders = async (parentId: string | null) => {
        setLoadingFolders(true)
        try {
            const param = parentId || "root"
            const res = await fetch(`/api/google-drive/folders?parentId=${param}`)
            if (!res.ok) throw new Error("Failed to load folders")
            const data = await res.json()
            setFolders(cleanFolders(Array.isArray(data.folders) ? data.folders : []))
        } catch {
            setMessage("error", "Failed to load folders.")
        } finally {
            setLoadingFolders(false)
        }
    }

    const openFolderPicker = () => {
        setPickingFolder(true)
        setCurrentFolder(null)
        setFolderStack([])
        void loadFolders(null)
    }

    const navigateToFolder = (folder: BreadcrumbEntry) => {
        if (currentFolder) {
            setFolderStack((prev) => [...prev, currentFolder])
        }
        setCurrentFolder(folder)
        void loadFolders(folder.id)
    }

    const navigateBack = () => {
        if (folderStack.length > 0) {
            const newStack = [...folderStack]
            const parent = newStack.pop()!
            setFolderStack(newStack)
            setCurrentFolder(parent)
            void loadFolders(parent.id)
        } else {
            setCurrentFolder(null)
            void loadFolders(null)
        }
    }

    const confirmFolder = async () => {
        if (!currentFolder) return
        try {
            const res = await fetch("/api/google-drive/folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folderId: currentFolder.id }),
            })
            if (!res.ok) throw new Error("Failed to set folder")
            const data = await res.json()
            const saved = { id: data.folder?.id || currentFolder.id, name: data.folder?.name || currentFolder.name }
            setSavedFolder(saved)
            setPickingFolder(false)
            setMessage("success", `Root folder set to ${saved.name}`)
        } catch {
            setMessage("error", "Could not set root folder.")
        }
    }

    const clearFolder = async () => {
        setSavedFolder(null)
        setPickingFolder(false)
        setMessage("success", "Root folder cleared.")
    }

    return (
        <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 border flex items-center justify-center shrink-0">
                    <GoogleDriveLogo className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Google Drive</p>
                    <p className="text-xs text-muted-foreground">
                        {config.connected
                            ? `Connected${config.connectedByName ? ` by ${config.connectedByName}` : ""}`
                            : "Not connected"}
                    </p>
                </div>
                {config.connected ? (
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                ) : (
                    <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                )}
            </div>

            {config.connected ? (
                <div className="space-y-3">
                    {/* Root folder setting */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Root folder</span>
                        <span className="font-medium">{savedFolder?.name || "My Drive"}</span>
                    </div>

                    {pickingFolder ? (
                        <div className="border rounded-lg overflow-hidden">
                            {/* Picker header */}
                            <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/50 text-xs">
                                <button
                                    onClick={navigateBack}
                                    disabled={!currentFolder}
                                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30 shrink-0"
                                >
                                    <ArrowLeft className="h-3 w-3" />
                                </button>
                                <span className="font-medium truncate flex-1">
                                    {currentFolder?.name || "My Drive"}
                                </span>
                            </div>

                            {/* Folder list */}
                            <ScrollArea className="max-h-40">
                                {loadingFolders ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                ) : folders.length === 0 ? (
                                    <div className="py-3 text-xs text-muted-foreground text-center">No folders</div>
                                ) : (
                                    folders.map((folder) => (
                                        <button
                                            key={folder.id}
                                            onClick={() => navigateToFolder(folder)}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
                                        >
                                            <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <span className="truncate flex-1">{folder.name}</span>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                        </button>
                                    ))
                                )}
                            </ScrollArea>

                            {/* Picker actions */}
                            <div className="border-t p-2 flex items-center gap-1.5">
                                <Button
                                    onClick={confirmFolder}
                                    disabled={!currentFolder}
                                    size="sm"
                                    className="flex-1"
                                >
                                    Set as root
                                </Button>
                                {savedFolder && (
                                    <Button variant="ghost" size="sm" onClick={clearFolder} className="text-xs">
                                        Clear
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setPickingFolder(false)} className="text-xs">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        canManage && (
                            <Button variant="outline" size="sm" onClick={openFolderPicker} className="w-full">
                                Change Root Folder
                            </Button>
                        )
                    )}

                    {/* Actions */}
                    {canManage && (
                        <div className="flex items-center gap-2 pt-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConnect}
                                disabled={connecting}
                                className="flex-1"
                            >
                                {connecting ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting...</>
                                ) : (
                                    "Switch Account"
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                                {disconnecting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    "Disconnect"
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                canManage && (
                    <Button
                        onClick={handleConnect}
                        disabled={connecting}
                        size="sm"
                        className="w-full"
                    >
                        {connecting ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Connecting...</>
                        ) : (
                            "Connect Google Drive"
                        )}
                    </Button>
                )
            )}

            {status && (
                <p className={cn("text-xs flex items-center gap-2", status.type === "error" ? "text-red-500" : "text-green-600")}>
                    {status.type === "error" ? <XCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {status.message}
                </p>
            )}
        </div>
    )
}

type IntegrationsTabProps = {
    driveConfig: DriveConfig
    discordChannelId: string | null
    isAdmin: boolean
}

export function IntegrationsTab({ driveConfig, discordChannelId, isAdmin }: IntegrationsTabProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Integrations</h2>
                <p className="text-xs text-muted-foreground mt-1">Connect external services to your workspace.</p>
            </div>

            <div className="space-y-4">
                <DriveCard config={driveConfig} canManage={isAdmin} />

                <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#5865F2] flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-white" viewBox="0 -28.5 256 256" xmlns="http://www.w3.org/2000/svg">
                                <path d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z" fill="currentColor"/>
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Discord</p>
                            <p className="text-xs text-muted-foreground">Send notifications to a Discord channel</p>
                        </div>
                    </div>
                    <DiscordChannelSettings initialChannelId={discordChannelId} isAdmin={isAdmin} />
                </div>
            </div>
        </div>
    )
}
