"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FileText, Loader2, Box } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TEXT_PREVIEW_ATTACHMENT_EXTENSIONS } from "@/lib/attachmentFileTypes"

type PreviewAttachment = {
    name: string
    url: string
    downloadUrl: string
    size?: number
    type?: string
}

type Vertex = { x: number; y: number; z: number }
type Face = [Vertex, Vertex, Vertex]

const TEXT_PREVIEW_EXTENSIONS = new Set(TEXT_PREVIEW_ATTACHMENT_EXTENSIONS)

const MAX_TEXT_PREVIEW_BYTES = 350_000
const MAX_STL_FACES = 18_000

function getExtension(fileName: string) {
    return fileName.split(".").pop()?.toLowerCase() || ""
}

export function canPreviewAttachment(fileName: string, fileType = "") {
    const extension = getExtension(fileName)
    return (
        isImagePreviewFile(fileName) ||
        isPdfPreviewFile(fileName, fileType) ||
        isStlPreviewFile(fileName, fileType) ||
        isTextPreviewFile(fileName, fileType)
    )
}

export function isPdfPreviewFile(fileName: string, fileType = "") {
    return getExtension(fileName) === "pdf" || fileType === "application/pdf"
}

export function isStlPreviewFile(fileName: string, fileType = "") {
    return getExtension(fileName) === "stl" || fileType === "model/stl" || fileType === "application/vnd.ms-pki.stl"
}

export function isTextPreviewFile(fileName: string, fileType = "") {
    const extension = getExtension(fileName)
    return TEXT_PREVIEW_EXTENSIONS.has(extension) || fileType.startsWith("text/")
}

function isImagePreviewFile(fileName: string) {
    return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(getExtension(fileName))
}

function formatFileSize(bytes?: number) {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function readLimitedText(url: string) {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error("Unable to load file preview")
    }

    if (!response.body) {
        const text = await response.text()
        return {
            text: text.slice(0, MAX_TEXT_PREVIEW_BYTES),
            truncated: text.length > MAX_TEXT_PREVIEW_BYTES,
        }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ""
    let bytesRead = 0
    let truncated = false

    while (bytesRead < MAX_TEXT_PREVIEW_BYTES) {
        const { value, done } = await reader.read()
        if (done) break
        bytesRead += value.byteLength
        text += decoder.decode(value, { stream: true })

        if (bytesRead >= MAX_TEXT_PREVIEW_BYTES) {
            truncated = true
            await reader.cancel()
            break
        }
    }

    text += decoder.decode()
    return {
        text: text.slice(0, MAX_TEXT_PREVIEW_BYTES),
        truncated,
    }
}

function parseAsciiStl(text: string): Face[] {
    const vertices: Vertex[] = []
    const vertexPattern = /vertex\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g
    let match: RegExpExecArray | null

    while ((match = vertexPattern.exec(text)) && vertices.length < MAX_STL_FACES * 3) {
        vertices.push({
            x: Number(match[1]),
            y: Number(match[2]),
            z: Number(match[3]),
        })
    }

    const faces: Face[] = []
    for (let index = 0; index + 2 < vertices.length; index += 3) {
        faces.push([vertices[index], vertices[index + 1], vertices[index + 2]])
    }
    return faces
}

function parseBinaryStl(buffer: ArrayBuffer): Face[] {
    if (buffer.byteLength < 84) return []

    const view = new DataView(buffer)
    const faceCount = view.getUint32(80, true)
    const expectedSize = 84 + faceCount * 50
    if (expectedSize > buffer.byteLength) return []

    const faces: Face[] = []
    const count = Math.min(faceCount, MAX_STL_FACES)

    for (let faceIndex = 0; faceIndex < count; faceIndex += 1) {
        const offset = 84 + faceIndex * 50
        const readVertex = (vertexOffset: number): Vertex => ({
            x: view.getFloat32(offset + vertexOffset, true),
            y: view.getFloat32(offset + vertexOffset + 4, true),
            z: view.getFloat32(offset + vertexOffset + 8, true),
        })
        faces.push([readVertex(12), readVertex(24), readVertex(36)])
    }

    return faces
}

function parseStl(buffer: ArrayBuffer): Face[] {
    const header = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.byteLength, 512)))
    if (header.trimStart().startsWith("solid")) {
        const text = new TextDecoder().decode(buffer)
        const asciiFaces = parseAsciiStl(text)
        if (asciiFaces.length > 0) return asciiFaces
    }

    return parseBinaryStl(buffer)
}

function drawStl(canvas: HTMLCanvasElement, faces: Face[]) {
    const ctx = canvas.getContext("2d")
    if (!ctx || faces.length === 0) return

    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#0f172a"
    ctx.fillRect(0, 0, width, height)

    const vertices = faces.flat()
    const min = {
        x: Math.min(...vertices.map((v) => v.x)),
        y: Math.min(...vertices.map((v) => v.y)),
        z: Math.min(...vertices.map((v) => v.z)),
    }
    const max = {
        x: Math.max(...vertices.map((v) => v.x)),
        y: Math.max(...vertices.map((v) => v.y)),
        z: Math.max(...vertices.map((v) => v.z)),
    }
    const center = {
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        z: (min.z + max.z) / 2,
    }
    const span = Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 1)
    const scale = Math.min(width, height) * 0.72 / span
    const cosY = Math.cos(-Math.PI / 4)
    const sinY = Math.sin(-Math.PI / 4)
    const cosX = Math.cos(0.62)
    const sinX = Math.sin(0.62)

    const project = (vertex: Vertex) => {
        const x = vertex.x - center.x
        const y = vertex.y - center.y
        const z = vertex.z - center.z
        const x1 = x * cosY + z * sinY
        const z1 = -x * sinY + z * cosY
        const y2 = y * cosX - z1 * sinX
        const z2 = y * sinX + z1 * cosX
        return {
            x: width / 2 + x1 * scale,
            y: height / 2 - y2 * scale,
            z: z2,
        }
    }

    const projectedFaces = faces
        .map((face) => {
            const points = face.map(project)
            const depth = points.reduce((sum, point) => sum + point.z, 0) / 3
            return { points, depth }
        })
        .sort((a, b) => a.depth - b.depth)

    for (const face of projectedFaces) {
        const [a, b, c] = face.points
        const shade = Math.max(0.22, Math.min(0.82, 0.5 + face.depth / span))
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.lineTo(c.x, c.y)
        ctx.closePath()
        ctx.fillStyle = `rgba(59, 130, 246, ${shade})`
        ctx.fill()
        ctx.strokeStyle = "rgba(226, 232, 240, 0.18)"
        ctx.lineWidth = 0.75
        ctx.stroke()
    }
}

function TextPreview({ url, fileName }: { url: string; fileName: string }) {
    const [state, setState] = useState<{ text: string; truncated: boolean; loading: boolean; error: string | null }>({
        text: "",
        truncated: false,
        loading: true,
        error: null,
    })

    useEffect(() => {
        let cancelled = false

        readLimitedText(url)
            .then((result) => {
                if (!cancelled) setState({ ...result, loading: false, error: null })
            })
            .catch((error) => {
                if (!cancelled) setState({ text: "", truncated: false, loading: false, error: error instanceof Error ? error.message : "Unable to load preview" })
            })

        return () => {
            cancelled = true
        }
    }, [url])

    if (state.error) {
        return <PreviewError message={state.error} />
    }

    if (state.loading) {
        return <PreviewLoading label="Loading text preview..." />
    }

    const extension = getExtension(fileName)

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                {extension === "step" || extension === "stp"
                    ? "STEP files are previewed as CAD source because browser solid rendering requires a CAD kernel."
                    : "Text preview"}
                {state.truncated && " Showing the first part of a large file."}
            </div>
            <pre className="flex-1 overflow-auto bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100">
                <code>{state.text}</code>
            </pre>
        </div>
    )
}

function StlPreview({ url }: { url: string }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [state, setState] = useState<{ faces: Face[]; error: string | null; loading: boolean }>({
        faces: [],
        error: null,
        loading: true,
    })

    useEffect(() => {
        let cancelled = false

        fetch(url)
            .then(async (response) => {
                if (!response.ok) throw new Error("Unable to load STL preview")
                return response.arrayBuffer()
            })
            .then((buffer) => {
                const faces = parseStl(buffer)
                if (faces.length === 0) throw new Error("No STL mesh data found")
                if (!cancelled) setState({ faces, error: null, loading: false })
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({
                        faces: [],
                        error: error instanceof Error ? error.message : "Unable to load STL preview",
                        loading: false,
                    })
                }
            })

        return () => {
            cancelled = true
        }
    }, [url])

    useEffect(() => {
        if (!canvasRef.current || state.faces.length === 0) return
        drawStl(canvasRef.current, state.faces)
    }, [state.faces])

    if (state.loading) {
        return <PreviewLoading label="Loading STL mesh..." />
    }

    if (state.error) {
        return <PreviewError message={state.error} />
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-slate-950">
            <div className="border-b border-white/10 bg-slate-900 px-4 py-2 text-xs text-slate-300">
                STL mesh preview ({state.faces.length.toLocaleString()} triangles)
            </div>
            <div className="flex flex-1 items-center justify-center p-4">
                <canvas
                    ref={canvasRef}
                    width={960}
                    height={560}
                    className="max-h-full w-full rounded-lg border border-white/10 bg-slate-950 shadow-inner"
                />
            </div>
        </div>
    )
}

function PreviewLoading({ label }: { label: string }) {
    return (
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            {label}
        </div>
    )
}

function PreviewError({ message }: { message: string }) {
    return (
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium">Preview unavailable</p>
            <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
        </div>
    )
}

function UnsupportedPreview({ fileName }: { fileName: string }) {
    return (
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Box className="h-12 w-12 text-muted-foreground" />
            <div>
                <p className="text-sm font-medium">No browser preview for this file yet</p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    {fileName} is stored and can be downloaded. Binary CAD formats like DWG, SLDPRT, IPT, and 3MF need a CAD conversion service before they can be rendered in-browser.
                </p>
            </div>
        </div>
    )
}

export function AttachmentPreviewDialog({
    attachment,
    open,
    onOpenChange,
    onDownload,
}: {
    attachment: PreviewAttachment | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onDownload: (url: string, fileName: string) => void
}) {
    if (!attachment) return null

    let previewKind: "image" | "pdf" | "stl" | "text" | "unsupported" = "unsupported"
    if (isImagePreviewFile(attachment.name)) previewKind = "image"
    else if (isPdfPreviewFile(attachment.name, attachment.type)) previewKind = "pdf"
    else if (isStlPreviewFile(attachment.name, attachment.type)) previewKind = "stl"
    else if (isTextPreviewFile(attachment.name, attachment.type)) previewKind = "text"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[88vh] max-h-[88vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-3 pr-8">
                        <div className="min-w-0">
                            <DialogTitle className="truncate text-sm">{attachment.name}</DialogTitle>
                            {attachment.size !== undefined && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            onClick={() => onDownload(attachment.downloadUrl, attachment.name)}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </Button>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 bg-background">
                    {previewKind === "image" && (
                        <div className="flex h-full items-center justify-center overflow-auto bg-muted/30 p-4">
                            <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    )}
                    {previewKind === "pdf" && (
                        <iframe
                            src={attachment.url}
                            className="h-full w-full bg-white"
                            title={`${attachment.name} preview`}
                        />
                    )}
                    {previewKind === "stl" && <StlPreview key={attachment.url} url={attachment.url} />}
                    {previewKind === "text" && <TextPreview key={attachment.url} url={attachment.url} fileName={attachment.name} />}
                    {previewKind === "unsupported" && <UnsupportedPreview fileName={attachment.name} />}
                </div>
            </DialogContent>
        </Dialog>
    )
}
