import assert from 'node:assert/strict'
import test from 'node:test'
import {
    applyCreatedTask,
    applyUpdatedTask,
    buildPushChains,
    getPushChainKey,
    inferLoadedPushes,
    mergeBoardTask,
    sortPushChainsByPriority,
    stabilizePushChainOrder,
    type BoardColumnState,
    type BoardPushState,
    type BoardTaskState,
} from '@/features/kanban/board-state'

type TestTask = BoardTaskState & {
    title: string
    assignee?: { id?: string; name: string } | null
    assignees?: { user: { id: string; name: string } }[]
    activityLogs?: { changedByName: string; createdAt: string }[]
    comments?: { createdAt: string }[]
    attachments?: { id: string; createdAt: string }[]
    marker?: string
}

type TestColumn = BoardColumnState<TestTask> & {
    name: string
    order: number
}

type TestPush = BoardPushState & {
    name: string
}

const PUSH_A = { id: 'push-a', name: 'Push A', color: '#3b82f6', status: 'Active' }
const PUSH_B = { id: 'push-b', name: 'Push B', color: '#10b981', status: 'Completed' }
const COLUMN_ORDER = ['todo', 'doing', 'review', 'done'] as const

function buildTask(overrides: Partial<TestTask> = {}): TestTask {
    return {
        id: 'task-1',
        title: 'Original task',
        columnId: 'doing',
        push: PUSH_A,
        assignee: { id: 'user-1', name: 'Avery Owner' },
        assignees: [{ user: { id: 'user-1', name: 'Avery Owner' } }],
        activityLogs: [{ changedByName: 'Lead', createdAt: '2026-03-19T10:00:00.000Z' }],
        comments: [{ createdAt: '2026-03-19T10:05:00.000Z' }],
        attachments: [{ id: 'attachment-1', createdAt: '2026-03-19T10:10:00.000Z' }],
        marker: 'existing-rich-shape',
        ...overrides,
    }
}

function buildPartialTask(overrides: Partial<TestTask> = {}): TestTask {
    return Object.fromEntries(
        Object.entries({
            id: 'task-1',
            title: 'Patched task',
            ...overrides,
        }).filter(([, value]) => value !== undefined)
    ) as TestTask
}

function buildColumns(taskOverrides: Partial<TestTask> = {}, extraTasks: TestTask[] = []): TestColumn[] {
    const task = buildTask(taskOverrides)
    return COLUMN_ORDER.map((id, index) => ({
        id,
        name: id,
        order: index,
        tasks: [
            ...(id === task.columnId ? [task] : []),
            ...extraTasks.filter((extraTask) => extraTask.columnId === id),
        ],
    }))
}

function countTask(columns: TestColumn[], taskId: string) {
    return columns.flatMap((column) => column.tasks).filter((task) => task.id === taskId).length
}

function findTask(columns: TestColumn[], taskId: string) {
    return columns.flatMap((column) => column.tasks).find((task) => task.id === taskId) ?? null
}

function buildPush(overrides: Partial<TestPush> = {}): TestPush {
    return {
        id: 'push-1',
        name: 'Push 1',
        startDate: '2026-03-20T00:00:00.000Z',
        dependsOnId: null,
        ...overrides,
    }
}

test('mergeBoardTask preserves rich fields when incoming updates are partial', () => {
    const existingTask = buildTask()
    const incomingTask = buildPartialTask({
        title: 'Renamed task',
    })

    const merged = mergeBoardTask(existingTask, incomingTask)

    assert.equal(merged.title, 'Renamed task')
    assert.equal(merged.push?.id, PUSH_A.id)
    assert.equal(merged.assignee?.name, 'Avery Owner')
    assert.equal(merged.assignees?.length, 1)
    assert.equal(merged.activityLogs?.length, 1)
    assert.equal(merged.comments?.length, 1)
    assert.equal(merged.attachments?.length, 1)
    assert.equal(merged.marker, 'existing-rich-shape')
})

test('mergeBoardTask preserves the existing column when the incoming update has no column id', () => {
    const merged = mergeBoardTask(
        buildTask({ columnId: 'review' }),
        buildTask({ columnId: null, title: 'Edited without column' })
    )

    assert.equal(merged.columnId, 'review')
    assert.equal(merged.title, 'Edited without column')
})

test('mergeBoardTask allows explicit push replacement and explicit backlog removal', () => {
    const existingTask = buildTask()
    const switchedPush = mergeBoardTask(existingTask, buildTask({ push: PUSH_B }))
    const removedPush = mergeBoardTask(existingTask, buildTask({ push: null }))

    assert.equal(switchedPush.push?.id, PUSH_B.id)
    assert.equal(removedPush.push, null)
})

test('stabilizePushChainOrder preserves the initial my-task ordering after live task-count changes', () => {
    const pushes = [
        buildPush({ id: 'push-1', name: 'Push 1', startDate: '2026-03-20T00:00:00.000Z' }),
        buildPush({ id: 'push-2', name: 'Push 2', startDate: '2026-03-21T00:00:00.000Z' }),
        buildPush({ id: 'push-3', name: 'Push 3', startDate: '2026-03-22T00:00:00.000Z' }),
    ]
    const chains = buildPushChains(pushes)
    const initialSortedChains = sortPushChainsByPriority(chains, { 'push-2': 2 }, () => false)
    const initialOrder = initialSortedChains.map((chain) => getPushChainKey(chain))
    const refreshedSortedChains = sortPushChainsByPriority(chains, { 'push-1': 1 }, () => false)

    const stabilized = stabilizePushChainOrder(initialOrder, chains, refreshedSortedChains)

    assert.deepEqual(
        stabilized.chains.map((chain) => getPushChainKey(chain)),
        ['push-2', 'push-1', 'push-3']
    )
})

test('stabilizePushChainOrder appends new chains without reshuffling the existing order', () => {
    const originalPushes = [
        buildPush({ id: 'push-1', name: 'Push 1', startDate: '2026-03-20T00:00:00.000Z' }),
        buildPush({ id: 'push-2', name: 'Push 2', startDate: '2026-03-21T00:00:00.000Z' }),
    ]
    const originalChains = buildPushChains(originalPushes)
    const initialOrder = sortPushChainsByPriority(originalChains, { 'push-2': 1 }, () => false)
        .map((chain) => getPushChainKey(chain))

    const nextPushes = [
        ...originalPushes,
        buildPush({ id: 'push-3', name: 'Push 3', startDate: '2026-03-19T00:00:00.000Z' }),
    ]
    const nextChains = buildPushChains(nextPushes)
    const nextSortedChains = sortPushChainsByPriority(nextChains, { 'push-3': 3 }, () => false)
    const stabilized = stabilizePushChainOrder(initialOrder, nextChains, nextSortedChains)

    assert.deepEqual(
        stabilized.chains.map((chain) => getPushChainKey(chain)),
        ['push-2', 'push-1', 'push-3']
    )
})

for (const columnId of COLUMN_ORDER) {
    for (const pushMode of ['no-push', 'push-a'] as const) {
        for (const duplicateMode of ['new-task', 'duplicate-task'] as const) {
            test(`applyCreatedTask ${duplicateMode} in ${columnId} with ${pushMode}`, () => {
                const newTask = buildTask({
                    id: 'created-task',
                    title: 'Created task',
                    columnId,
                    push: pushMode === 'push-a' ? PUSH_A : null,
                    marker: 'created-shape',
                })
                const columns = buildColumns({}, duplicateMode === 'duplicate-task' ? [buildTask({
                    id: 'created-task',
                    title: 'Old duplicate',
                    columnId,
                    push: PUSH_B,
                    marker: 'stale-duplicate',
                })] : [])

                const result = applyCreatedTask(columns, newTask)
                const insertedTask = findTask(result, 'created-task')

                assert.ok(insertedTask)
                assert.equal(countTask(result, 'created-task'), 1)
                assert.equal(insertedTask?.columnId, columnId)
                assert.equal(insertedTask?.push?.id ?? null, pushMode === 'push-a' ? PUSH_A.id : null)
                assert.equal(insertedTask?.marker, 'created-shape')
            })
        }
    }
}

const updateVariants = [
    {
        name: 'partial same column preserves push',
        buildIncomingTask: (existingTask: TestTask) => buildPartialTask({
            id: existingTask.id,
            title: 'Edited partial',
            columnId: existingTask.columnId,
        }),
        expectedColumnId: (existingTask: TestTask) => existingTask.columnId,
        expectedPushId: (existingTask: TestTask) => existingTask.push?.id ?? null,
        expectRichFieldsPreserved: true,
    },
    {
        name: 'partial move keeps existing push',
        buildIncomingTask: (existingTask: TestTask) => buildPartialTask({
            id: existingTask.id,
            title: 'Moved partial',
            columnId: existingTask.columnId === 'todo' ? 'doing' : 'todo',
        }),
        expectedColumnId: (existingTask: TestTask) => existingTask.columnId === 'todo' ? 'doing' : 'todo',
        expectedPushId: (existingTask: TestTask) => existingTask.push?.id ?? null,
        expectRichFieldsPreserved: true,
    },
    {
        name: 'hydrated same column can change push',
        buildIncomingTask: (existingTask: TestTask) => buildTask({
            id: existingTask.id,
            title: 'Hydrated edit',
            columnId: existingTask.columnId,
            push: PUSH_B,
            marker: 'hydrated-shape',
        }),
        expectedColumnId: (existingTask: TestTask) => existingTask.columnId,
        expectedPushId: () => PUSH_B.id,
        expectRichFieldsPreserved: false,
    },
    {
        name: 'hydrated move to backlog clears push explicitly',
        buildIncomingTask: (existingTask: TestTask) => buildTask({
            id: existingTask.id,
            title: 'Move to backlog',
            columnId: existingTask.columnId === 'review' ? 'doing' : 'review',
            push: null,
            marker: 'hydrated-backlog',
        }),
        expectedColumnId: (existingTask: TestTask) => existingTask.columnId === 'review' ? 'doing' : 'review',
        expectedPushId: () => null,
        expectRichFieldsPreserved: false,
    },
    {
        name: 'missing column falls back to existing location',
        buildIncomingTask: (existingTask: TestTask) => buildPartialTask({
            id: existingTask.id,
            title: 'Edited without column',
            columnId: null,
        }),
        expectedColumnId: (existingTask: TestTask) => existingTask.columnId,
        expectedPushId: (existingTask: TestTask) => existingTask.push?.id ?? null,
        expectRichFieldsPreserved: true,
    },
    {
        name: 'same column partial with no push still preserves metadata',
        buildIncomingTask: (existingTask: TestTask) => buildPartialTask({
            id: existingTask.id,
            title: 'Title only edit',
            columnId: existingTask.columnId,
        }),
        expectedColumnId: (existingTask: TestTask) => existingTask.columnId,
        expectedPushId: (existingTask: TestTask) => existingTask.push?.id ?? null,
        expectRichFieldsPreserved: true,
    },
] as const

for (const existingColumnId of COLUMN_ORDER) {
    for (const existingPush of [null, PUSH_A] as const) {
        for (const richMode of ['rich', 'minimal'] as const) {
            for (const variant of updateVariants) {
                test(`applyUpdatedTask ${variant.name} from ${existingColumnId} with ${existingPush ? existingPush.id : 'no-push'} and ${richMode} existing shape`, () => {
                    const existingTask = buildTask({
                        columnId: existingColumnId,
                        push: existingPush,
                        assignee: richMode === 'rich' ? { id: 'user-1', name: 'Avery Owner' } : undefined,
                        assignees: richMode === 'rich' ? [{ user: { id: 'user-1', name: 'Avery Owner' } }] : undefined,
                        activityLogs: richMode === 'rich' ? [{ changedByName: 'Lead', createdAt: '2026-03-19T10:00:00.000Z' }] : undefined,
                        comments: richMode === 'rich' ? [{ createdAt: '2026-03-19T10:05:00.000Z' }] : undefined,
                        attachments: richMode === 'rich' ? [{ id: 'attachment-1', createdAt: '2026-03-19T10:10:00.000Z' }] : undefined,
                        marker: richMode === 'rich' ? 'rich-existing' : 'minimal-existing',
                    })
                    const columns = buildColumns(existingTask)
                    const result = applyUpdatedTask(columns, variant.buildIncomingTask(existingTask))
                    const updatedTask = findTask(result, existingTask.id)

                    assert.ok(updatedTask)
                    assert.equal(countTask(result, existingTask.id), 1)
                    assert.equal(updatedTask?.columnId, variant.expectedColumnId(existingTask))
                    assert.equal(updatedTask?.push?.id ?? null, variant.expectedPushId(existingTask))
                    assert.equal(updatedTask?.title, variant.buildIncomingTask(existingTask).title)

                    const sourceColumnTaskIds = result.find((column) => column.id === existingColumnId)?.tasks.map((task) => task.id) ?? []
                    const targetColumnTaskIds = result.find((column) => column.id === variant.expectedColumnId(existingTask))?.tasks.map((task) => task.id) ?? []

                    if (variant.expectedColumnId(existingTask) !== existingColumnId) {
                        assert.equal(sourceColumnTaskIds.includes(existingTask.id), false)
                        assert.equal(targetColumnTaskIds.includes(existingTask.id), true)
                    }

                    if (variant.expectRichFieldsPreserved && richMode === 'rich') {
                        assert.equal(updatedTask?.assignee?.name, 'Avery Owner')
                        assert.equal(updatedTask?.assignees?.length, 1)
                        assert.equal(updatedTask?.activityLogs?.length, 1)
                        assert.equal(updatedTask?.comments?.length, 1)
                        assert.equal(updatedTask?.attachments?.length, 1)
                        assert.equal(updatedTask?.marker, 'rich-existing')
                    }
                })
            }
        }
    }
}

for (const columnId of COLUMN_ORDER) {
    for (const pushMode of [null, PUSH_A, PUSH_B] as const) {
        test(`applyUpdatedTask inserts missing task into ${columnId} with ${pushMode?.id ?? 'no-push'}`, () => {
            const columns = buildColumns({ id: 'another-task' })
            const result = applyUpdatedTask(columns, buildTask({
                id: 'inserted-task',
                title: 'Inserted by update',
                columnId,
                push: pushMode,
                marker: 'inserted-shape',
            }))
            const insertedTask = findTask(result, 'inserted-task')

            assert.ok(insertedTask)
            assert.equal(countTask(result, 'inserted-task'), 1)
            assert.equal(insertedTask?.columnId, columnId)
            assert.equal(insertedTask?.push?.id ?? null, pushMode?.id ?? null)
            assert.equal(insertedTask?.marker, 'inserted-shape')
        })
    }
}

test('applyUpdatedTask leaves the board untouched when neither the existing nor incoming task has a column', () => {
    const columns = buildColumns({ id: 'stable-task' })
    const result = applyUpdatedTask(columns, buildTask({
        id: 'orphan-task',
        title: 'No column anywhere',
        columnId: null,
        push: null,
    }))

    assert.deepEqual(result, columns)
})

const inferLoadedPushCases = [
    {
        name: 'marks a push as loaded when actual task count matches expected count',
        columns: buildColumns({ push: PUSH_A }, [buildTask({ id: 'task-2', columnId: 'todo', push: PUSH_A })]),
        pushes: [{ id: PUSH_A.id, taskCount: 2 }],
        expected: { [PUSH_A.id]: true },
    },
    {
        name: 'does not mark a push as loaded when actual task count is lower',
        columns: buildColumns({ push: PUSH_A }),
        pushes: [{ id: PUSH_A.id, taskCount: 2 }],
        expected: {},
    },
    {
        name: 'supports multiple pushes independently',
        columns: buildColumns({ push: PUSH_A }, [
            buildTask({ id: 'task-2', columnId: 'todo', push: PUSH_B }),
            buildTask({ id: 'task-3', columnId: 'review', push: PUSH_B }),
        ]),
        pushes: [
            { id: PUSH_A.id, taskCount: 1 },
            { id: PUSH_B.id, taskCount: 2 },
        ],
        expected: { [PUSH_A.id]: true, [PUSH_B.id]: true },
    },
]

for (const testCase of inferLoadedPushCases) {
    test(`inferLoadedPushes ${testCase.name}`, () => {
        assert.deepEqual(inferLoadedPushes(testCase.columns, testCase.pushes), testCase.expected)
    })
}
