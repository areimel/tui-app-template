/**
The Tasks screen: filter tabs, a windowed task list, a detail pane, and add/edit/delete dialogs.
State lives here; the pure rules are in `tasks-model.ts`.
*/
import {useState} from 'react';
import {Box} from 'ink';
import {
	useAppConfig,
	useScreenSize,
	useServices,
	useToast,
} from '../../shell/context.js';
import {useListNav} from '../../ui/hooks/index.js';
import {useKeys} from '../../ui/input/index.js';
import {ConfirmDialog, Tabs, T, VirtualList} from '../../ui/kit/index.js';
import {TASK_KEY_BINDINGS} from './bindings.js';
import {TASKS_CONFIG} from './config.js';
import {useTaskFile} from './use-task-file.js';
import {TaskDetail} from './TaskDetail.js';
import {TaskFormDialog} from './TaskFormDialog.js';
import {TaskRow} from './TaskRow.js';
import {
	detailRowsFor,
	dialogWidth,
	listHeightFor,
	planRow,
} from './tasks-layout.js';
import {toDateString} from './task-dates.js';
import {draftFromTask, EMPTY_DRAFT} from './task-draft.js';
import {
	countTasks,
	nextFilter,
	reduceTasks,
	visibleTasks,
	type Task,
	type TaskAction,
	type TaskInput,
} from './tasks-model.js';

type DialogState =
	| {readonly type: 'add'}
	| {readonly type: 'edit'; readonly id: number}
	| {readonly type: 'delete'; readonly id: number};

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

export function Screen() {
	const {columns, rows} = useScreenSize();
	const services = useServices();
	const toast = useToast();
	const [config, updateConfig] = useAppConfig('tasks', TASKS_CONFIG);
	const {filter} = config;

	const {store, file, setFile, isLoaded} = useTaskFile();
	const [dialog, setDialog] = useState<DialogState | undefined>();
	const [trash, setTrash] = useState<Task | undefined>();
	const [focusId, setFocusId] = useState<number | undefined>();

	const today = toDateString(services.now());
	const counts = countTasks(file.tasks);
	const visible = visibleTasks(file.tasks, filter);
	const listHeight = listHeightFor(rows);
	const hasScrollbar = visible.length > listHeight;
	const plan = planRow(columns - 2 - (hasScrollbar ? 1 : 0));

	const nav = useListNav({
		count: visible.length,
		pageSize: Math.max(1, listHeight - 1),
		isActive: isLoaded,
		onSelect(index) {
			const task = visible[index];
			if (task !== undefined) {
				setDialog({type: 'edit', id: task.id});
			}
		},
	});

	/**
	Apply an action and save. `followId` keeps the cursor on that task: its row may move when the sort
	changes, so the cursor is re-aimed during the next render (below), before anything is drawn.
	*/
	const apply = (action: TaskAction, followId?: number) => {
		const next = reduceTasks(file, action);
		setFile(next);
		store.save(next);
		setFocusId(followId);
	};

	if (focusId !== undefined) {
		setFocusId(undefined);
		const index = visible.findIndex(task => task.id === focusId);
		if (index !== -1) {
			nav.setCursor(index);
		}
	}

	const current = visible[nav.cursor];

	useKeys(
		TASK_KEY_BINDINGS,
		{
			toggle() {
				if (current !== undefined) {
					apply({type: 'toggle', id: current.id}, current.id);
				}
			},
			add() {
				setDialog({type: 'add'});
			},
			edit() {
				if (current !== undefined) {
					setDialog({type: 'edit', id: current.id});
				}
			},
			delete() {
				if (current !== undefined) {
					setDialog({type: 'delete', id: current.id});
				}
			},
			filter() {
				updateConfig({filter: nextFilter(filter)});
				nav.setCursor(0);
			},
			priority() {
				if (current !== undefined) {
					apply({type: 'cyclePriority', id: current.id}, current.id);
				}
			},
			undo() {
				if (trash === undefined) {
					toast('Nothing to undo.', 'warn');
					return;
				}

				apply({type: 'restore', task: trash}, trash.id);
				setTrash(undefined);
				toast(`Restored "${trash.title}".`);
			},
		},
		{isActive: isLoaded},
	);

	const close = () => {
		setDialog(undefined);
	};

	const save = (input: TaskInput, isDone: boolean) => {
		if (dialog?.type === 'edit') {
			apply({type: 'edit', id: dialog.id, input, isDone}, dialog.id);
			toast(`Saved "${input.title}".`);
		} else {
			apply({type: 'add', input, now: services.now()}, file.nextId);
			toast(`Added "${input.title}".`);
		}

		close();
	};

	const target =
		dialog !== undefined && dialog.type !== 'add'
			? file.tasks.find(task => task.id === dialog.id)
			: undefined;

	const confirmDelete = () => {
		if (target !== undefined) {
			apply({type: 'delete', id: target.id});
			setTrash(target);
			toast(`Deleted "${target.title}". Press u to undo.`);
		}

		close();
	};

	const detailRows = detailRowsFor(rows);
	const tabs = [
		{value: 'all' as const, label: `All ${counts.all}`},
		{value: 'open' as const, label: `Open ${counts.open}`},
		{value: 'done' as const, label: `Done ${counts.done}`},
	];

	return (
		<Box flexDirection="column" width={columns} height={rows}>
			<Tabs isFocused tabs={tabs} value={filter} />
			{!isLoaded && <T tone="muted">Loading tasks…</T>}
			{isLoaded && visible.length === 0 && (
				<EmptyState hasTasks={file.tasks.length > 0} filter={filter} />
			)}
			{isLoaded && visible.length > 0 && (
				<VirtualList
					isFocused
					items={visible}
					cursor={nav.cursor}
					height={listHeight}
					hasScrollbar={hasScrollbar}
					getKey={task => String(task.id)}
					renderItem={(task, {isCursor}) => (
						<TaskRow
							task={task}
							today={today}
							plan={plan}
							isCursor={isCursor}
						/>
					)}
				/>
			)}
			{detailRows > 0 && isLoaded && visible.length > 0 && <Box flexGrow={1} />}
			{detailRows > 0 && isLoaded && visible.length > 0 && (
				<TaskDetail task={current} today={today} width={columns} />
			)}
			{dialog?.type === 'delete' && target !== undefined && (
				<ConfirmDialog
					isDanger
					title="Delete task"
					message={`Delete "${target.title}"?`}
					confirmLabel="Delete"
					width={dialogWidth(columns, CONFIRM_WIDTH)}
					onConfirm={confirmDelete}
					onCancel={close}
				/>
			)}
			{(dialog?.type === 'add' ||
				(dialog?.type === 'edit' && target !== undefined)) && (
				<TaskFormDialog
					title={dialog.type === 'add' ? 'Add task' : 'Edit task'}
					initial={target === undefined ? EMPTY_DRAFT : draftFromTask(target)}
					isEdit={dialog.type === 'edit'}
					width={dialogWidth(columns, FORM_WIDTH)}
					onSave={save}
					onCancel={close}
				/>
			)}
		</Box>
	);
}
