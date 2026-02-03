"use client"

export default function SettingsLoading() {
    return (
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl mx-auto p-6">
            {/* Sidebar skeleton */}
            <div className="hidden md:flex flex-col gap-1 w-[180px] shrink-0 pt-1">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-9 rounded-md bg-muted animate-pulse"
                        style={{ animationDelay: `${i * 60}ms` }}
                    />
                ))}
            </div>

            {/* Content skeleton */}
            <div className="flex-1 space-y-5">
                <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="rounded-lg p-4 space-y-3 bg-muted/30"
                    >
                        <div
                            className="h-4 w-32 bg-muted rounded animate-pulse"
                            style={{ animationDelay: `${i * 80}ms` }}
                        />
                        <div
                            className="h-10 w-full bg-muted rounded animate-pulse"
                            style={{ animationDelay: `${i * 80 + 40}ms` }}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
