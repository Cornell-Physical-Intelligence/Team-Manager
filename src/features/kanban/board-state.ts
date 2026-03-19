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
