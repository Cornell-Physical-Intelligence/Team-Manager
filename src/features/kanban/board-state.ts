export type BoardTaskState = {
    id: string
    columnId: string | null
    push?: { id: string; name: string; color: string; status: string } | null
    [key: string]: unknown
}

export type BoardColumnState<TTask extends BoardTaskState = BoardTaskState> = {
    id: string
    tasks: TTask[]
    [key: string]: unknown
}

export type PushLoadState = {
    id: string
    taskCount: number
}

export type BoardPushState = {
    id: string
    startDate: Date | string
    dependsOnId?: string | null
}

export type PushChainState<TPush extends BoardPushState = BoardPushState> = TPush[]

export function inferLoadedPushes<TTask extends BoardTaskState>(
    columns: Array<BoardColumnState<TTask>>,
    pushList: PushLoadState[]
): Record<string, true> {
    const countsByPush = new Map<string, number>()

    for (const column of columns) {
        for (const task of column.tasks) {
            const pushId = task.push?.id
            if (!pushId) continue
            countsByPush.set(pushId, (countsByPush.get(pushId) || 0) + 1)
        }
    }

    const loaded: Record<string, true> = {}
    for (const push of pushList) {
        const actual = countsByPush.get(push.id) || 0
        if (actual === push.taskCount) loaded[push.id] = true
    }

    return loaded
}

export function mergeBoardTask<TTask extends BoardTaskState>(existingTask: TTask | null, incomingTask: TTask): TTask {
    if (!existingTask) {
        return incomingTask
    }

    const mergedTask = { ...existingTask } as TTask

    for (const [key, value] of Object.entries(incomingTask)) {
        if (value !== undefined) {
            mergedTask[key as keyof TTask] = value as TTask[keyof TTask]
        }
    }

    mergedTask.columnId = incomingTask.columnId ?? existingTask.columnId

    return mergedTask
}

export function buildPushChains<TPush extends BoardPushState>(pushes: TPush[]): PushChainState<TPush>[] {
    const pushMap = new Map(pushes.map((push) => [push.id, push]))
    const processed = new Set<string>()
    const chains: PushChainState<TPush>[] = []

    const roots = pushes
        .filter((push) => !push.dependsOnId || !pushMap.has(push.dependsOnId))
        .slice()
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

    for (const root of roots) {
        if (processed.has(root.id)) continue

        const chain: TPush[] = [root]
        processed.add(root.id)

        let current = root
        while (true) {
            const next = pushes.find((push) => push.dependsOnId === current.id && !processed.has(push.id))
            if (!next) break
            chain.push(next)
            processed.add(next.id)
            current = next
        }

        chains.push(chain)
    }

    for (const push of pushes) {
        if (processed.has(push.id)) continue
        chains.push([push])
        processed.add(push.id)
    }

    return chains
}

export function getPushChainKey<TPush extends BoardPushState>(chain: PushChainState<TPush>) {
    return chain[0]?.id ?? ""
}

export function sortPushChainsByPriority<TPush extends BoardPushState>(
    chains: PushChainState<TPush>[],
    myTaskCounts: Record<string, number>,
    isPushMarkedComplete: (pushId: string) => boolean
): PushChainState<TPush>[] {
    return chains.slice().sort((a, b) => {
        const aMyTaskCount = a.reduce((sum, push) => sum + (myTaskCounts[push.id] ?? 0), 0)
        const bMyTaskCount = b.reduce((sum, push) => sum + (myTaskCounts[push.id] ?? 0), 0)
        const aHasMyTasks = aMyTaskCount > 0
        const bHasMyTasks = bMyTaskCount > 0

        if (aHasMyTasks !== bHasMyTasks) {
            return aHasMyTasks ? -1 : 1
        }

        if (aMyTaskCount !== bMyTaskCount) {
            return bMyTaskCount - aMyTaskCount
        }

        const aComplete = a.every((push) => isPushMarkedComplete(push.id))
        const bComplete = b.every((push) => isPushMarkedComplete(push.id))

        if (aComplete !== bComplete) {
            return aComplete ? 1 : -1
        }

        const aPrimaryPush = a.find((push) => !isPushMarkedComplete(push.id)) ?? a[0]
        const bPrimaryPush = b.find((push) => !isPushMarkedComplete(push.id)) ?? b[0]

        return new Date(aPrimaryPush.startDate).getTime() - new Date(bPrimaryPush.startDate).getTime()
    })
}

export function stabilizePushChainOrder<TPush extends BoardPushState>(
    previousOrder: string[] | null | undefined,
    chains: PushChainState<TPush>[],
    defaultSortedChains: PushChainState<TPush>[]
) {
    const availableKeys = new Set(
        chains
            .map((chain) => getPushChainKey(chain))
            .filter((key) => key.length > 0)
    )

    const defaultOrder = defaultSortedChains
        .map((chain) => getPushChainKey(chain))
        .filter((key, index, list) => key.length > 0 && list.indexOf(key) === index)

    const retainedOrder = (previousOrder ?? []).filter((key, index, list) => (
        key.length > 0 &&
        availableKeys.has(key) &&
        list.indexOf(key) === index
    ))
    const retainedKeySet = new Set(retainedOrder)
    const appendedOrder = defaultOrder.filter((key) => availableKeys.has(key) && !retainedKeySet.has(key))
    const nextOrder = [...retainedOrder, ...appendedOrder]
    const nextOrderIndex = new Map(nextOrder.map((key, index) => [key, index] as const))
    const fallbackIndex = new Map(defaultOrder.map((key, index) => [key, index] as const))
    const fallbackOffset = nextOrder.length

    return {
        order: nextOrder,
        chains: chains.slice().sort((a, b) => {
            const aKey = getPushChainKey(a)
            const bKey = getPushChainKey(b)
            const aIndex = nextOrderIndex.get(aKey)
            const bIndex = nextOrderIndex.get(bKey)
            const aFallback = fallbackIndex.get(aKey) ?? Number.MAX_SAFE_INTEGER
            const bFallback = fallbackIndex.get(bKey) ?? Number.MAX_SAFE_INTEGER

            return (aIndex ?? fallbackOffset + aFallback) - (bIndex ?? fallbackOffset + bFallback)
        }),
    }
}

export function applyCreatedTask<TTask extends BoardTaskState, TColumn extends BoardColumnState<TTask>>(
    columns: TColumn[],
    newTask: TTask
): TColumn[] {
    return columns.map((column) => {
        if (column.id !== newTask.columnId) {
            return column
        }

        const existingTask = column.tasks.find((task) => task.id === newTask.id) ?? null
        if (existingTask) {
            return {
                ...column,
                tasks: column.tasks.map((task) => task.id === newTask.id ? mergeBoardTask(task, newTask) : task),
            }
        }

        return {
            ...column,
            tasks: [...column.tasks, newTask],
        }
    })
}

export function applyUpdatedTask<TTask extends BoardTaskState, TColumn extends BoardColumnState<TTask>>(
    columns: TColumn[],
    updatedTask: TTask
): TColumn[] {
    const existingTask = columns.flatMap((column) => column.tasks).find((task) => task.id === updatedTask.id) ?? null
    const mergedTask = mergeBoardTask(existingTask, updatedTask)

    if (!mergedTask.columnId) {
        return columns
    }

    return columns.map((column) => {
        const existingTaskIndex = column.tasks.findIndex((task) => task.id === mergedTask.id)

        if (column.id === mergedTask.columnId) {
            if (existingTaskIndex !== -1) {
                const nextTasks = [...column.tasks]
                nextTasks[existingTaskIndex] = mergeBoardTask(column.tasks[existingTaskIndex] ?? null, mergedTask)
                return {
                    ...column,
                    tasks: nextTasks,
                }
            }

            return {
                ...column,
                tasks: [...column.tasks, mergedTask],
            }
        }

        if (existingTaskIndex !== -1) {
            return {
                ...column,
                tasks: column.tasks.filter((task) => task.id !== mergedTask.id),
            }
        }

        return column
    })
}
