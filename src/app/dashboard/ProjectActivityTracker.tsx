"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { ChevronRight, TrendingUp, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type PushStats = {
    id: string
    name: string
    startDate: string
    endDate: string | null
    status: string
    total: number
    completed: number
    inReview: number
    inProgress: number
    todo: number
}

type ProjectActivity = {
    id: string
    name: string
    color: string
    totalTasks: number
    totalCompleted: number
    totalInReview: number
    completionRate: number
    pushes: PushStats[]
}

export function ProjectActivityTracker() {
    const router = useRouter()
    const [projects, setProjects] = useState<ProjectActivity[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedProject, setSelectedProject] = useState<string | null>(null)

    useEffect(() => {
        fetchProjectActivity()
    }, [])

    const fetchProjectActivity = async () => {
        try {
            const res = await fetch('/api/projects/activity')
            if (res.ok) {
                const data = await res.json()
                setProjects(data)
                // Auto-select first project with pushes
                const firstWithPushes = data.find((p: ProjectActivity) => p.pushes.length > 0)
                if (firstWithPushes) {
                    setSelectedProject(firstWithPushes.id)
                }
            }
        } catch (error) {
            console.error('Failed to fetch project activity:', error)
        } finally {
            setLoading(false)
        }
    }

    const selectedProjectData = projects.find(p => p.id === selectedProject)

    // Prepare chart data from selected project's pushes
    const chartData = selectedProjectData?.pushes.map(push => ({
        name: push.name.length > 12 ? push.name.slice(0, 12) + '...' : push.name,
        fullName: push.name,
        completed: push.completed,
        inReview: push.inReview,
        inProgress: push.inProgress,
        todo: push.todo,
        total: push.total
    })) || []

    const navigateToProject = (projectId: string) => {
        router.push(`/dashboard/projects/${projectId}`)
    }

    if (loading) {
        return (
            <section className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            </section>
        )
    }

    if (projects.length === 0) {
        return (
            <section className="border border-border rounded-lg p-4">
                <h2 className="text-sm font-medium mb-3">Project Activity</h2>
                <p className="text-xs text-muted-foreground text-center py-8">
                    No projects found
                </p>
            </section>
        )
    }

    return (
        <section className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    Project Activity
                </h2>
            </div>

            {/* Project Selector */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                {projects.map(project => (
                    <button
                        key={project.id}
                        onClick={() => setSelectedProject(project.id)}
                        className={cn(
                            "px-2.5 py-1 rounded text-[10px] font-medium whitespace-nowrap transition-all shrink-0",
                            selectedProject === project.id
                                ? "bg-foreground text-background"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                    >
                        {project.name}
                    </button>
                ))}
            </div>

            {selectedProjectData && (
                <>
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center p-2 rounded bg-muted/30">
                            <div className="text-lg font-semibold">{selectedProjectData.totalCompleted}</div>
                            <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Completed
                            </div>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/30">
                            <div className="text-lg font-semibold">{selectedProjectData.totalInReview}</div>
                            <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                In Review
                            </div>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/30">
                            <div className="text-lg font-semibold">{selectedProjectData.completionRate}%</div>
                            <div className="text-[9px] text-muted-foreground">
                                Complete
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart - Sprint Activity */}
                    {chartData.length > 0 ? (
                        <div className="h-36 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
                                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                                    barCategoryGap="20%"
                                >
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                                        axisLine={{ stroke: 'hsl(var(--border))' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={25}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--background))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '6px',
                                            fontSize: '10px',
                                            padding: '8px'
                                        }}
                                        labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                                        formatter={(value, name) => {
                                            const labels: Record<string, string> = {
                                                completed: 'Completed',
                                                inReview: 'In Review',
                                                inProgress: 'In Progress',
                                                todo: 'To Do'
                                            }
                                            return [value ?? 0, labels[name as string] || name]
                                        }}
                                        labelFormatter={(label, payload) => {
                                            const item = payload?.[0]?.payload
                                            return item?.fullName || label
                                        }}
                                    />
                                    <Bar dataKey="completed" stackId="a" fill="hsl(var(--foreground))" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="inReview" stackId="a" fill="hsl(var(--muted-foreground))" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="inProgress" stackId="a" fill="hsl(var(--muted-foreground) / 0.5)" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="todo" stackId="a" fill="hsl(var(--muted-foreground) / 0.2)" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-36 flex items-center justify-center text-xs text-muted-foreground">
                            No sprints in this project
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-4 mt-3 text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-foreground" />
                            Done
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-muted-foreground" />
                            Review
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-muted-foreground/50" />
                            Progress
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-muted-foreground/20" />
                            To Do
                        </span>
                    </div>

                    {/* View Project Link */}
                    <button
                        onClick={() => navigateToProject(selectedProjectData.id)}
                        className="w-full mt-4 flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-2 border-t border-border"
                    >
                        View {selectedProjectData.name}
                        <ChevronRight className="h-3 w-3" />
                    </button>
                </>
            )}
        </section>
    )
}
