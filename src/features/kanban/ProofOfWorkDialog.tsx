import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useState } from "react"

interface ProofOfWorkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (imageUrl: string) => void
    onCancel: () => void
}

export function ProofOfWorkDialog({ open, onOpenChange, onConfirm, onCancel }: ProofOfWorkDialogProps) {
    const [imageUrl, setImageUrl] = useState("")

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) onCancel()
            onOpenChange(val)
        }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Submit Proof of Work</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="image" className="text-right">
                            Link / URL
                        </Label>
                        <Input
                            id="image"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="col-span-3"
                            placeholder="https://..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => onConfirm(imageUrl)} disabled={!imageUrl.trim()}>Submit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
