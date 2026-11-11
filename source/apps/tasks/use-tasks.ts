/**
State and key handling of the Tasks screen: the loaded file, the filter, the cursor, the open dialog,
the undo slot and every action. `Screen.tsx` only lays the result out.
*/
import {useState} from 'react';
import {useAppConfig, useServices, useToast} from '../../shell/context.js';
import {useListNav} from '../../ui/hooks/index.js';
import {useKeys} from '../../ui/input/index.js';
import {SELECT_LABEL, TASK_KEY_BINDINGS} from './bindings.js';
import {APP_ID, TASKS_CONFIG} from './config.js';
import {listHeightFor} from './tasks-layout.js';
import {
	countTasks,
	nextFilter,
	reduceTasks,
	visibleTasks,
	type Task,
	type TaskAction,
	type TaskInput,
} from './tasks-model.js';
import {useTaskFile} from './use-task-file.js';

export type DialogState =
	| {readonly type: 'add'}
	| {readonly type: 'edit'; readonly id: number}
	| {readonly type: 'delete'; readonly id: number};

export function useTasks(rows: number) {
	const services = useServices();
	const toast = useToast();
	const [config, updateConfig] = useAppConfig(APP_ID, TASKS_CONFIG);
	const {filter} = config;
	const {store, file, setFile, isLoaded} = useTaskFile();
	const [dialog, setDialog] = useState<DialogState | undefined>();
	const [trash, setTrash] = useState<Task | undefined>();
	const [focusId, setFocusId] = useState<number | undefined>();

	const visible = visibleTasks(file.tasks, filter);
	const listHeight = listHeightFor(rows);

	const nav = useListNav({
		count: visible.length,
		pageSize: Math.max(1, listHeight - 1),
		isActive: isLoaded,
		selectLabel: SELECT_LABEL,
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
	const onCurrent = (run: (task: Task) => void) => () => {
		if (current !== undefined) {
			run(current);
		}
	};

	useKeys(
		TASK_KEY_BINDINGS,
		{
			toggle: onCurrent(task => {
				apply({type: 'toggle', id: task.id}, task.id);
			}),
			add() {
				setDialog({type: 'add'});
			},
			edit: onCurrent(task => {
				setDialog({type: 'edit', id: task.id});
			}),
			delete: onCurrent(task => {
				setDialog({type: 'delete', id: task.id});
			}),
			filter() {
				updateConfig({filter: nextFilter(filter)});
				nav.setCursor(0);
			},
			priority: onCurrent(task => {
				apply({type: 'cyclePriority', id: task.id}, task.id);
			}),
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

	const target =
		dialog !== undefined && dialog.type !== 'add'
			? file.tasks.find(task => task.id === dialog.id)
			: undefined;

	return {
		filter,
		file,
		isLoaded,
		visible,
		listHeight,
		cursor: nav.cursor,
		current,
		counts: countTasks(file.tasks),
		now: services.now(),
		dialog,
		target,
		close,
		save(input: TaskInput, isDone: boolean) {
			if (dialog?.type === 'edit') {
				apply({type: 'edit', id: dialog.id, input, isDone}, dialog.id);
				toast(`Saved "${input.title}".`);
			} else {
				apply({type: 'add', input, now: services.now()}, file.nextId);
				toast(`Added "${input.title}".`);
			}

			close();
		},
		confirmDelete() {
			if (target !== undefined) {
				apply({type: 'delete', id: target.id});
				setTrash(target);
				toast(`Deleted "${target.title}". Press u to undo.`);
			}

			close();
		},
	};
}
