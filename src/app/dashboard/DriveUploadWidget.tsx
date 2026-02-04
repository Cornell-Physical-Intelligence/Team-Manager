"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
    Check, ChevronLeft, ChevronRight, ExternalLink, File, FileAudio,
    FileImage, FileSpreadsheet, FileText, FileVideo, FolderOpen,
    Loader2, RefreshCw, Settings, Upload, XCircle
} from "lucide-react"

/* ── Types ─────────────────────────────────────────────── */

type DriveConfig = {
    connected: boolean
    folderId: string | null
    folderName: string | null
    connectedByName: string | null
}

type DriveUploadWidgetProps = {
    initialConfig: DriveConfig
    canManage: boolean
    className?: string
}

type DriveFolderNode = {
    id: string
    name: string
    parents: string[]
    modifiedTime?: string | null
}

type DriveFileItem = {
    id: string
    name: string
    mimeType: string
    modifiedTime: string | null
    size: string | null
    iconLink: string | null
    webViewLink: string | null
}

/* ── Helpers ───────────────────────────────────────────── */

function getFileIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return FileImage
    if (mimeType.startsWith("video/")) return FileVideo
    if (mimeType.startsWith("audio/")) return FileAudio
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet
    if (mimeType.includes("document") || mimeType.includes("text") || mimeType.includes("pdf")) return FileText
    return File
}

function formatRelativeDate(dateStr: string | null) {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

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

/* ── Component ─────────────────────────────────────────── */

export function DriveUploadWidget({ initialConfig, canManage, className }: DriveUploadWidgetProps) {
    /* ── State ── */
    const [folderTree, setFolderTree] = useState<DriveFolderNode[]>([])
    const [loadingTree, setLoadingTree] = useState(false)
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialConfig.folderId)
    const [folderStack, setFolderStack] = useState<string[]>([])
    const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
    const [dragTarget, setDragTarget] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [files, setFiles] = useState<DriveFileItem[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [widgetDragOver, setWidgetDragOver] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const dragCounterRef = useRef(0)

    const rootFolderId = initialConfig.folderId
    const rootFolderName = initialConfig.folderName || "Root"

    /* ── Memoized maps ── */
    const folderMap = useMemo(() => {
        const map = new Map<string, DriveFolderNode>()
        folderTree.forEach((node) => map.set(node.id, node))
        return map
    }, [folderTree])

    const childrenMap = useMemo(() => {
        const map = new Map<string, DriveFolderNode[]>()
        folderTree.forEach((node) => {
            node.parents?.forEach((parentId) => {
                if (!map.has(parentId)) map.set(parentId, [])
                map.get(parentId)!.push(node)
            })
        })
        map.forEach((children) =>
            children.sort((a, b) => {
                const aTime = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0
                const bTime = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0
                return bTime - aTime
            })
        )
        return map
    }, [folderTree])

    const currentChildren = currentFolderId ? childrenMap.get(currentFolderId) || [] : []
    const isRootLevel = currentFolderId === rootFolderId
    const hasChildren = (folderId: string) => (childrenMap.get(folderId) || []).length > 0

    /* ── Breadcrumbs ── */
    const breadcrumbs = useMemo(() => {
        if (!rootFolderId) return []
        const crumbs: { id: string; name: string }[] = [{ id: rootFolderId, name: rootFolderName }]
        for (const folderId of folderStack) {
            if (folderId === rootFolderId) continue
            const node = folderMap.get(folderId)
            crumbs.push({ id: folderId, name: node?.name || "Folder" })
        }
        if (currentFolderId && currentFolderId !== rootFolderId) {
            const node = folderMap.get(currentFolderId)
            crumbs.push({ id: currentFolderId, name: node?.name || "Folder" })
        }
        return crumbs
    }, [folderStack, currentFolderId, rootFolderId, rootFolderName, folderMap])

    /* ── Status helper ── */
    const setMessage = (type: "success" | "error", message: string, duration = 4000) => {
        setStatus({ type, message })
        setTimeout(() => setStatus(null), duration)
    }

    /* ── Data fetching ── */
    const fetchTree = async (preserveNavigation = false) => {
        if (!rootFolderId) return
        setLoadingTree(true)
        try {
            const res = await fetch(`/api/google-drive/folders/tree?rootId=${rootFolderId}`)
            if (!res.ok) throw new Error("Failed to load folders")
            const data = await res.json()
            setFolderTree(Array.isArray(data.folders) ? data.folders : [])
            if (!preserveNavigation) {
                setCurrentFolderId(rootFolderId)
                setFolderStack([])
            }
        } catch (error) {
            console.error(error)
            setMessage("error", "Failed to load folders.")
        } finally {
            setLoadingTree(false)
        }
    }

    const fetchFiles = async (folderId: string) => {
        setLoadingFiles(true)
        try {
            const res = await fetch(`/api/google-drive/files?folderId=${folderId}`)
            if (!res.ok) throw new Error("Failed to load files")
            const data = await res.json()
            setFiles(Array.isArray(data.files) ? data.files : [])
        } catch (error) {
            console.error(error)
            setFiles([])
        } finally {
            setLoadingFiles(false)
        }
    }

    useEffect(() => {
        if (initialConfig.connected && rootFolderId) {
            void fetchTree()
            void fetchFiles(rootFolderId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialConfig.connected, rootFolderId])

    /* ── Navigation ── */
    const navigateToFolder = (folderId: string) => {
        if (!folderId) return
        if (currentFolderId) {
            setFolderStack((prev) => [...prev, currentFolderId])
        }
        setCurrentFolderId(folderId)
        void fetchFiles(folderId)
    }

    const navigateBack = () => {
        if (folderStack.length === 0) {
            setCurrentFolderId(rootFolderId)
            setFiles([])
            if (rootFolderId) void fetchFiles(rootFolderId)
            return
        }
        const next = [...folderStack]
        const parent = next.pop()!
        setFolderStack(next)
        setCurrentFolderId(parent)
        void fetchFiles(parent)
    }

    const navigateToBreadcrumb = (index: number) => {
        const crumb = breadcrumbs[index]
        if (!crumb) return
        if (index === 0) {
            setCurrentFolderId(rootFolderId)
            setFolderStack([])
            setFiles([])
            if (rootFolderId) void fetchFiles(rootFolderId)
        } else {
            const newStack = breadcrumbs.slice(1, index).map((c) => c.id)
            setFolderStack(newStack)
            setCurrentFolderId(crumb.id)
            void fetchFiles(crumb.id)
        }
    }

    /* ── Upload ── */
    const uploadFiles = async (filesToUpload: File[], folderId: string, folderName?: string) => {
        if (!rootFolderId) {
            setMessage("error", "Select a destination folder in Settings first.")
            return
        }
        if (filesToUpload.length === 0) return

        const name = folderName || "folder"
        setUploading(true)
        setStatus({ type: "success", message: `Uploading ${filesToUpload.length} file${filesToUpload.length === 1 ? "" : "s"} to ${name}...` })

        try {
            const formData = new FormData()
            filesToUpload.forEach((file) => formData.append("files", file, file.name))
            formData.append("folderId", folderId)

            const res = await fetch("/api/google-drive/upload", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Upload failed")
            }

            setPendingFiles(null)
            setMessage(
                "success",
                `${filesToUpload.length} file${filesToUpload.length === 1 ? "" : "s"} sent to ${name}. They'll appear shortly.`,
                6000
            )
            setTimeout(() => {
                if (currentFolderId) void fetchFiles(currentFolderId)
            }, 2000)
        } catch (error) {
            console.error(error)
            setMessage("error", "Upload failed. Try again.")
        } finally {
            setUploading(false)
        }
    }

    const handleFileSelection = (selectedFiles: File[]) => {
        if (selectedFiles.length === 0) return
        const targetId = currentFolderId || rootFolderId
        if (!targetId) return

        if (hasChildren(targetId)) {
            setPendingFiles(selectedFiles)
            setMessage("success", `Choose a subfolder for ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}.`)
            return
        }

        const targetName = folderMap.get(targetId)?.name || rootFolderName
        void uploadFiles(selectedFiles, targetId, targetName)
    }

    /* ── Drag-and-drop (folder cards) ── */
    const handleDropToFolder = (event: DragEvent<HTMLDivElement>, folderId: string) => {
        event.preventDefault()
        event.stopPropagation()
        setDragTarget(null)
        dragCounterRef.current = 0
        setWidgetDragOver(false)
        if (pendingFiles) return
        const droppedFiles = Array.from(event.dataTransfer.files || [])
        if (droppedFiles.length === 0) return

        if (hasChildren(folderId)) {
            setPendingFiles(droppedFiles)
            navigateToFolder(folderId)
            setMessage("success", `Choose a subfolder for ${droppedFiles.length} file${droppedFiles.length === 1 ? "" : "s"}.`)
            return
        }

        const targetName = folderMap.get(folderId)?.name
        void uploadFiles(droppedFiles, folderId, targetName)
    }

    /* ── Drag-and-drop (widget level) ── */
    const handleWidgetDragEnter = (e: DragEvent<HTMLElement>) => {
        e.preventDefault()
        dragCounterRef.current++
        if (dragCounterRef.current === 1) setWidgetDragOver(true)
    }

    const handleWidgetDragLeave = () => {
        dragCounterRef.current--
        if (dragCounterRef.current === 0) setWidgetDragOver(false)
    }

    const handleWidgetDragOver = (e: DragEvent<HTMLElement>) => {
        e.preventDefault()
    }

    const handleWidgetDrop = (e: DragEvent<HTMLElement>) => {
        e.preventDefault()
        dragCounterRef.current = 0
        setWidgetDragOver(false)
        if (pendingFiles) return
        const droppedFiles = Array.from(e.dataTransfer.files || [])
        if (droppedFiles.length === 0) return
        handleFileSelection(droppedFiles)
    }

    /* ── Refresh ── */
    const handleRefresh = async () => {
        setRefreshing(true)
        await fetchTree(true)
        if (currentFolderId) await fetchFiles(currentFolderId)
        setRefreshing(false)
    }

    /* ── File input handler ── */
    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || [])
        if (selectedFiles.length === 0) return
        handleFileSelection(selectedFiles)
        e.target.value = ""
    }

    /* ── Folder click handler ── */
    const handleFolderClick = (folder: DriveFolderNode) => {
        if (pendingFiles) {
            if (hasChildren(folder.id)) {
                navigateToFolder(folder.id)
                setMessage("success", `Choose a subfolder in ${folder.name}.`)
            } else {
                void uploadFiles(pendingFiles, folder.id, folder.name)
            }
            return
        }
        navigateToFolder(folder.id)
    }

    /* ═══ Render: Not connected ═══ */
    if (!initialConfig.connected) {
        return (
            <section className={cn("border border-border rounded-lg overflow-hidden flex flex-col h-full", className)}>
                <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/30 dark:to-green-950/30 p-6 flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center">
                            <GoogleDriveLogo className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-medium text-sm">Google Drive</h3>
                            <p className="text-xs text-muted-foreground max-w-[220px]">
                                {canManage
                                    ? "Set up Google Drive in Settings to upload files"
                                    : "Contact an admin to connect Google Drive"}
                            </p>
                        </div>
                        {canManage && (
                            <Link href="/dashboard/settings?tab=integrations">
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Settings className="h-3.5 w-3.5" />
                                    Open Settings
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </section>
        )
    }

    /* ═══ Render: Connected ═══ */
    return (
        <section
            className={cn(
                "border border-border rounded-lg p-3 flex flex-col h-full relative",
                widgetDragOver && "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20",
                className
            )}
            onDragEnter={handleWidgetDragEnter}
            onDragLeave={handleWidgetDragLeave}
            onDragOver={handleWidgetDragOver}
            onDrop={handleWidgetDrop}
        >
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
            />

            {/* Drop overlay */}
            {widgetDragOver && !pendingFiles && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-blue-50/80 dark:bg-blue-950/50 border-2 border-dashed border-blue-400 pointer-events-none">
                    <div className="flex flex-col items-center gap-1.5">
                        <Upload className="h-6 w-6 text-blue-500" />
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            Drop files to upload
                        </span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center bg-white dark:bg-zinc-800 border">
                        <GoogleDriveLogo className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold">Google Drive</span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            {rootFolderId ? rootFolderName : "No root folder"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {rootFolderId && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={handleRefresh}
                                        disabled={refreshing || loadingTree}
                                        className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                                    >
                                        <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", refreshing && "animate-spin")} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Refresh</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {canManage && (
                        <Link href="/dashboard/settings?tab=integrations">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                                Settings
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* No root folder */}
            {!rootFolderId && (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Select a destination folder in Settings to enable uploads.
                </div>
            )}

            {/* Main content */}
            {rootFolderId && (
                <div className="flex-1 flex flex-col gap-2 min-h-0">
                    {/* Navigation: back + breadcrumbs + upload */}
                    <div className="flex items-center gap-1.5">
                        {!isRootLevel && (
                            <button
                                onClick={navigateBack}
                                className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                                aria-label="Go back"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                        )}

                        <div className="flex-1 flex items-center gap-1 text-[11px] text-muted-foreground overflow-x-auto whitespace-nowrap min-w-0 scrollbar-none">
                            {breadcrumbs.map((crumb, i) => (
                                <span key={`${crumb.id}-${i}`} className="flex items-center gap-1 shrink-0">
                                    {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                                    <button
                                        onClick={() => navigateToBreadcrumb(i)}
                                        className={cn(
                                            "hover:text-foreground transition-colors truncate max-w-[100px]",
                                            i === breadcrumbs.length - 1 ? "font-medium text-foreground" : ""
                                        )}
                                    >
                                        {crumb.name}
                                    </button>
                                </span>
                            ))}
                        </div>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading || !currentFolderId}
                                        className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                                    >
                                        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Upload files</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Pending files banner */}
                    {pendingFiles && (
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
                            <span className="text-amber-700 dark:text-amber-400">
                                {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} ready — pick a folder
                            </span>
                            <button
                                onClick={() => {
                                    setPendingFiles(null)
                                    setMessage("success", "Cancelled.")
                                }}
                                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Content area */}
                    {loadingTree ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <ScrollArea className="flex-1">
                            <div className="flex flex-col gap-2">
                                {/* Subfolders: grid at root, list otherwise */}
                                {isRootLevel ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {currentChildren.map((folder) => (
                                            <div
                                                key={folder.id}
                                                className={cn(
                                                    "border rounded-lg p-3 text-xs flex flex-col gap-2 transition-all cursor-pointer hover:bg-muted/40",
                                                    !pendingFiles && dragTarget === folder.id && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                                                )}
                                                onDragOver={(e) => {
                                                    if (pendingFiles) return
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setDragTarget(folder.id)
                                                }}
                                                onDragLeave={(e) => {
                                                    e.stopPropagation()
                                                    setDragTarget(null)
                                                }}
                                                onDrop={(e) => handleDropToFolder(e, folder.id)}
                                            >
                                                <button
                                                    onClick={() => handleFolderClick(folder)}
                                                    className="flex items-center gap-2 text-left"
                                                >
                                                    <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="font-medium text-foreground truncate">{folder.name}</span>
                                                </button>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {pendingFiles ? "Click to select" : "Drop or click"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    currentChildren.map((folder) => (
                                        <button
                                            key={folder.id}
                                            onClick={() => handleFolderClick(folder)}
                                            className="w-full flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-xs text-left hover:bg-muted/40 transition-colors"
                                        >
                                            <span className="flex items-center gap-2 min-w-0">
                                                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="font-medium text-foreground truncate">{folder.name}</span>
                                            </span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {pendingFiles ? "Click to send" : "Open"}
                                            </span>
                                        </button>
                                    ))
                                )}

                                {/* Files */}
                                {loadingFiles ? (
                                    <div className="flex items-center justify-center py-3">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                ) : files.length > 0 ? (
                                    <>
                                        {currentChildren.length > 0 && (
                                            <div className="border-t border-border my-1" />
                                        )}
                                        {files.map((file) => {
                                            const Icon = getFileIcon(file.mimeType)
                                            const driveUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`
                                            return (
                                                <a
                                                    key={file.id}
                                                    href={driveUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors group"
                                                >
                                                    <span className="flex items-center gap-2 min-w-0">
                                                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <span className="text-foreground truncate">{file.name}</span>
                                                    </span>
                                                    <span className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[10px] text-muted-foreground">{formatRelativeDate(file.modifiedTime)}</span>
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </span>
                                                </a>
                                            )
                                        })}
                                    </>
                                ) : null}

                                {/* Empty state */}
                                {currentChildren.length === 0 && files.length === 0 && !loadingFiles && (
                                    <div className="text-xs text-muted-foreground text-center py-6">
                                        This folder is empty.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            )}

            {/* Status message */}
            {status && (
                <div className="mt-2">
                    <p className={cn(
                        "text-xs flex items-center gap-2 p-2 rounded-md",
                        status.type === "error"
                            ? "text-red-600 bg-red-50 dark:bg-red-950/30"
                            : "text-green-600 bg-green-50 dark:bg-green-950/30"
                    )}>
                        {status.type === "error" ? <XCircle className="h-3 w-3 shrink-0" /> : <Check className="h-3 w-3 shrink-0" />}
                        {status.message}
                    </p>
                </div>
            )}
        </section>
    )
}
