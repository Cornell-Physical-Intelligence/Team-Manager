"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { type PushDraft } from "./types"

type ChainSquareProps = {
    push: PushDraft
    state: 'completed' | 'upcoming'
    onClick: () => void
}

const SQUARE_SIZE = 32

export function ChainSquare({ push, state, onClick }: ChainSquareProps) {
    const isCompleted = state === 'completed'

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={onClick}
                    className={cn(
                        "relative flex items-center justify-center shrink-0 rounded-md cursor-pointer",
                        "transition-all duration-200",
                        "hover:scale-105 hover:brightness-110",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                    )}
                    style={{
                        width: SQUARE_SIZE,
                        height: SQUARE_SIZE,
                        background: isCompleted
                            ? `${push.color}cc`
                            : `repeating-linear-gradient(
                                45deg,
                                ${push.color}66,
                                ${push.color}66 4px,
                                ${push.color}33 4px,
                                ${push.color}33 8px
                              )`,
                        opacity: isCompleted ? 1 : 0.7
                    }}
                >
                    {isCompleted && (
                        <Check
                            className="h-4 w-4 text-white animate-checkmark-appear"
                            strokeWidth={3}
                        />
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                <div className="font-medium">{push.name || 'Untitled'}</div>
                <div className="text-muted-foreground">
                    {isCompleted ? 'Completed' : 'Upcoming'}
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
