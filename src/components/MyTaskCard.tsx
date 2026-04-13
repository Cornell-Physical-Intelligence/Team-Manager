"use client"

import { useState } from "react"
import { TaskPreview } from "@/features/kanban/TaskPreview"

type MyTaskCardProps = {
    task: {
        id: string
        title: string
        description: string | null
        assignee: { id: string; name: string } | null
        column: {
            name: string
            board: {
                project: {
                    id: string
                    name: string
                    color?: string | null
                }
            }
        } | null
        createdAt: Date | string | null
        updatedAt: Date | string | null
    }
}

export function MyTaskCard({ task }: MyTaskCardProps) {
    const [showTaskPreview, setShowTaskPreview] = useState(false)

    const project = task.column?.board?.project
    const projectColor = project?.color || '#6b7280'

    return (
        <>
            <div
                onClick={() => setShowTaskPreview(true)}
                className="group cursor-pointer rounded-md p-2.5 border border-border/60 bg-card hover:border-border hover:shadow-sm active:scale-[0.99] transition-all duration-150"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-medium leading-snug line-clamp-2">
                            {task.title}
                        </h4>
                        {project && (
                            <span
                                className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1.5"
                                style={{
                                    backgroundColor: `${projectColor}12`,
                                    color: projectColor
                                }}
                            >
                                {project.name}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {showTaskPreview && (
                <TaskPreview
                    task={{
                        id: task.id,
                        title: task.title,
                        description: task.description,
                        assignee: task.assignee,
                        column: task.column,
                        columnId: null,
                        createdAt: task.createdAt || undefined,
                        updatedAt: task.updatedAt || undefined
                    }}
                    open={showTaskPreview}
                    onOpenChange={setShowTaskPreview}
                    onEdit={() => { }}
                    projectId={project?.id || ''}
                />
            )}
        </>
    )
}
