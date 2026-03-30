export function DashboardRouteSkeleton() {
    return (
        <div className="h-full overflow-y-auto">
            <div className="p-3 md:p-4 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-6 w-44 bg-muted rounded animate-pulse" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-4">
                        <section className="rounded-lg p-4 bg-muted/30">
                            <div className="mb-3">
                                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="h-10 bg-muted rounded animate-pulse"
                                        style={{ animationDelay: `${i * 50}ms` }}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="rounded-lg p-4 bg-muted/30">
                            <div className="h-4 w-32 bg-muted rounded animate-pulse mb-3" />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                                    <div
                                        key={i}
                                        className="h-20 bg-muted rounded-md animate-pulse"
                                        style={{ animationDelay: `${i * 40}ms` }}
                                    />
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="space-y-4">
                        <section className="rounded-lg p-4 bg-muted/30">
                            <div className="h-4 w-28 bg-muted rounded animate-pulse mb-3" />
                            <div className="space-y-2">
                                <div className="h-36 bg-muted rounded-lg animate-pulse" />
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="h-8 bg-muted rounded animate-pulse"
                                        style={{ animationDelay: `${i * 60}ms` }}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="rounded-lg p-4 bg-muted/30">
                            <div className="h-4 w-16 bg-muted rounded animate-pulse mb-3" />
                            <div className="space-y-2">
                                {[0, 1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="h-10 bg-muted rounded animate-pulse"
                                        style={{ animationDelay: `${i * 45}ms` }}
                                    />
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function MyBoardRouteSkeleton() {
    return (
        <div className="h-full flex flex-col">
            <div className="p-3 md:p-4 flex items-center justify-between shrink-0">
                <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            </div>

            <div className="flex-1 overflow-x-auto p-3 md:p-4">
                <div className="flex gap-3 h-full">
                    {[0, 1, 2, 3].map((colIndex) => (
                        <div
                            key={colIndex}
                            className="w-72 flex flex-col bg-muted/30 rounded-lg shrink-0"
                        >
                            <div className="p-3 flex items-center justify-between">
                                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                                <div className="h-5 w-5 bg-muted rounded-full animate-pulse" />
                            </div>

                            <div className="flex-1 p-2 space-y-2">
                                {Array.from({ length: Math.max(1, 3 - colIndex % 2) }).map((_, cardIndex) => (
                                    <div
                                        key={cardIndex}
                                        className="h-16 bg-muted rounded-lg animate-pulse"
                                        style={{ animationDelay: `${(colIndex * 3 + cardIndex) * 40}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function ProjectRouteSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <div className="shrink-0 border-b bg-background">
                <div className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-7 w-20 bg-muted/50 rounded animate-pulse delay-75" />
                    </div>
                    <div className="h-8 w-16 bg-muted rounded-lg animate-pulse" />
                </div>
            </div>

            <div className="flex-1 overflow-x-auto p-3">
                <div className="flex gap-3 h-full">
                    {[0, 1, 2, 3].map((colIndex) => (
                        <div
                            key={colIndex}
                            className="w-[280px] flex flex-col bg-muted/30 rounded-lg shrink-0"
                        >
                            <div className="p-3 flex items-center justify-between">
                                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                                <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
                            </div>
                            <div className="flex-1 p-2 space-y-2">
                                {Array.from({ length: Math.max(1, 3 - colIndex % 2) }).map((_, cardIndex) => (
                                    <div
                                        key={cardIndex}
                                        className="bg-muted/60 rounded-lg p-3 animate-pulse"
                                        style={{ animationDelay: `${(colIndex * 3 + cardIndex) * 40}ms` }}
                                    >
                                        <div className="h-3.5 w-3/4 bg-muted rounded" />
                                        <div className="mt-2 h-3 w-1/2 bg-muted/80 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
