/**
The pane under the list: a rule, the highlighted task's notes and its facts.
*/
import {Box} from 'ink';
import {T} from '../../ui/kit/index.js';
import {OVERDUE_GLYPH, PRIORITY_GLYPH} from './TaskRow.js';
import {isOverdue, toDateString} from './task-dates.js';
import type {Task} from './tasks-model.js';

export type TaskDetailProps = {
	readonly task: Task | undefined;
	readonly today: string;
	readonly width: number;
};

function facts(task: Task, today: string): string {
	const overdue = isOverdue(task, today) ? [`${OVERDUE_GLYPH} overdue`] : [];
	return [
		...overdue,
		`${PRIORITY_GLYPH[task.priority]} ${task.priority} priority`,
		task.due === undefined ? 'no due date' : `due ${task.due}`,
		`added ${toDateString(task.createdAt)}`,
	].join(' · ');
}

export function TaskDetail({task, today, width}: TaskDetailProps) {
	return (
		<Box flexDirection="column" width={width} flexShrink={0}>
			<T tone="border">{'─'.repeat(width)}</T>
			<T wrap="truncate-end" tone={task?.notes === '' ? 'muted' : 'text'}>
				{task === undefined ? '' : task.notes === '' ? 'No notes.' : task.notes}
			</T>
			<T wrap="truncate-end" tone="muted">
				{task === undefined ? '' : facts(task, today)}
			</T>
		</Box>
	);
}
