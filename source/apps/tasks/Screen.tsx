/**
The Tasks screen: filter tabs, a windowed task list, a detail pane, and add/edit/delete dialogs.
State and keys live in `use-tasks.ts`; the pure rules are in `tasks-model.ts`.
*/
import {Box} from 'ink';
import {useScreenSize} from '../../shell/context.js';
import {ConfirmDialog, Tabs, T, VirtualList} from '../../ui/kit/index.js';
import {TaskDetail} from './TaskDetail.js';
import {TaskFormDialog} from './TaskFormDialog.js';
import {TaskRow} from './TaskRow.js';
import {detailRowsFor, dialogWidth, planRow} from './tasks-layout.js';
import {toDateString} from './task-dates.js';
import {draftFromTask, EMPTY_DRAFT} from './task-draft.js';
import {useTasks} from './use-tasks.js';

const FORM_WIDTH = 60;
const CONFIRM_WIDTH = 44;

function EmptyState({
	hasTasks,
	filter,
}: {
	readonly hasTasks: boolean;
	readonly filter: string;
}) {
	return (
		<Box flexDirection="column">
			<T tone="muted">{hasTasks ? `No ${filter} tasks.` : 'No tasks yet.'}</T>
			<T>
				{hasTasks
					? 'Press tab to change the filter, or a to add one.'
					: 'Press a to add your first task.'}
			</T>
		</Box>
	);
}

/**
The list area: loading text, the empty state, or the list with the detail pane under it.
*/
function TaskBody({
	tasks,
	columns,
	rows,
}: {
	readonly tasks: ReturnType<typeof useTasks>;
	readonly columns: number;
	readonly rows: number;
}) {
	if (!tasks.isLoaded) {
		return <T tone="muted">Loading tasks…</T>;
	}

	if (tasks.visible.length === 0) {
		return (
			<EmptyState
				hasTasks={tasks.file.tasks.length > 0}
				filter={tasks.filter}
			/>
		);
	}

	const today = toDateString(tasks.now);
	const hasScrollbar = tasks.visible.length > tasks.listHeight;
	const plan = planRow(columns - 2 - (hasScrollbar ? 1 : 0));
	const hasDetail = detailRowsFor(rows) > 0;
	return (
		<>
			<VirtualList
				isFocused
				items={tasks.visible}
				cursor={tasks.cursor}
				height={tasks.listHeight}
				hasScrollbar={hasScrollbar}
				getKey={task => String(task.id)}
				renderItem={(task, {isCursor}) => (
					<TaskRow task={task} today={today} plan={plan} isCursor={isCursor} />
				)}
			/>
			{hasDetail ? <Box flexGrow={1} /> : null}
			{hasDetail ? (
				<TaskDetail task={tasks.current} today={today} width={columns} />
			) : null}
		</>
	);
}

export function Screen() {
	const {columns, rows} = useScreenSize();
	const tasks = useTasks(rows);
	const {dialog, target, counts} = tasks;
	const tabs = [
		{value: 'all' as const, label: `All ${counts.all}`},
		{value: 'open' as const, label: `Open ${counts.open}`},
		{value: 'done' as const, label: `Done ${counts.done}`},
	];
	const isFormOpen =
		dialog?.type === 'add' || (dialog?.type === 'edit' && target !== undefined);

	return (
		<Box flexDirection="column" width={columns} height={rows}>
			<Tabs isFocused tabs={tabs} value={tasks.filter} width={columns} />
			<TaskBody tasks={tasks} columns={columns} rows={rows} />
			{target !== undefined && dialog?.type === 'delete' ? (
				<ConfirmDialog
					isDanger
					title="Delete task"
					message={`Delete "${target.title}"?`}
					confirmLabel="Delete"
					width={dialogWidth(columns, CONFIRM_WIDTH)}
					onConfirm={tasks.confirmDelete}
					onCancel={tasks.close}
				/>
			) : null}
			{isFormOpen ? (
				<TaskFormDialog
					title={dialog.type === 'add' ? 'Add task' : 'Edit task'}
					initial={target === undefined ? EMPTY_DRAFT : draftFromTask(target)}
					isEdit={dialog.type === 'edit'}
					width={dialogWidth(columns, FORM_WIDTH)}
					onSave={tasks.save}
					onCancel={tasks.close}
				/>
			) : null}
		</Box>
	);
}
