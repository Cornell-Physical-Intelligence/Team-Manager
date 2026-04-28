import crypto from "crypto"
import {
    ALLOWED_ATTACHMENT_EXTENSIONS,
    PLAIN_TEXT_ATTACHMENT_RESPONSE_EXTENSIONS,
} from "./attachmentFileTypes"

export const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024

const ALLOWED_MIME_PREFIXES = [
    "image/",
    "video/",
    "audio/",
    "model/",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/sla",
    "application/vnd.ms-pki.stl",
    "text/",
    "application/zip",
    "application/x-zip",
    "application/json",
    "application/xml",
]

export function getAttachmentExtension(fileName: string) {
    return fileName.split(".").pop()?.toLowerCase() || ""
}

export function isAllowedAttachmentType(fileName: string, fileType: string) {
    const extension = getAttachmentExtension(fileName)
    const allowedByExtension = ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)
    const allowedByMime =
        fileType.length > 0 &&
        !fileType.startsWith("text/") &&
        ALLOWED_MIME_PREFIXES.some((prefix) => fileType.startsWith(prefix))

    return allowedByMime || allowedByExtension
}

export function getAttachmentResponseContentType(fileName: string, fileType: string) {
    const extension = getAttachmentExtension(fileName)
    if (PLAIN_TEXT_ATTACHMENT_RESPONSE_EXTENSIONS.includes(extension)) {
        return "text/plain; charset=utf-8"
    }

    return fileType || "application/octet-stream"
}

export function buildAttachmentAccessUrl(attachmentId: string, download = false) {
    return `/api/attachments/${attachmentId}${download ? "?download=1" : ""}`
}

export function buildAttachmentStoragePath(taskId: string, fileName: string) {
    const extension = getAttachmentExtension(fileName)
    const suffix = extension ? `.${extension}` : ""
    return `${taskId}/${crypto.randomUUID()}${suffix}`
}

export function buildAttachmentContentDisposition(fileName: string, download: boolean) {
    const disposition = download ? "attachment" : "inline"
    const sanitized = fileName.replace(/[\r\n"]/g, "_")
    const encoded = encodeURIComponent(fileName)
    return `${disposition}; filename="${sanitized}"; filename*=UTF-8''${encoded}`
}
