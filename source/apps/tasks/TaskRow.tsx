/**
One task row: `[x] title  ▲ high  ⚠ 2026-11-05`. State is carried by glyphs, not colour alone.
*/
import {Box} from 'ink';
import {T} from '../../ui/kit/index.js';
import type {TokenName} from '../../theme/tokens.js';
import type {RowPlan} from './tasks-layout.js';
import {isOverdue} from './task-dates.js';
import type {Priority, Task} from './tasks-model.js';

export const PRIORITY_GLYPH: Readonly<Record<Priority, string>> = {
	high: '▲',
	normal: '●',
	low: '▽',
};

const PRIORITY_TONE: Readonly<Record<Priority, TokenName>> = {
	high: 'err',
	normal: 'text',
	low: 'muted',
};

export const OVERDUE_GLYPH = '⚠';

export type TaskRowProps = {
	readonly task: Task;
	readonly today: string;
	readonly plan: RowPlan;
	readonly isCursor: boolean;
};

/**
The due cell text: `⚠` for overdue, a blank in its place otherwise.
*/
export function dueCell(task: Task, today: string, hasYear: boolean): string {
	if (task.due === undefined) {
		return '';
	}

	const date = hasYear ? task.due : task.due.slice(5);
	return `${isOverdue(task, today) ? OVERDUE_GLYPH : ' '} ${date}`;
}

export function TaskRow({task, today, plan, isCursor}: TaskRowProps) {
	const priorityText = plan.hasPriorityText
		? `${PRIORITY_GLYPH[task.priority]} ${task.priority}`
		: PRIORITY_GLYPH[task.priority];
	const isLate = isOverdue(task, today);
	return (
		<Box width={plan.titleWidth + 4 + plan.priorityWidth + plan.dueWidth}>
			<Box width={4} flexShrink={0}>
				<T tone={task.isDone ? 'muted' : 'text'} bold={isCursor}>
					{task.isDone ? '[x] ' : '[ ] '}
				</T>
			</Box>
			<Box width={plan.titleWidth} flexShrink={0}>
				<T
					wrap="truncate-end"
					tone={task.isDone ? 'muted' : 'text'}
					bold={isCursor}
				>
					{task.title}
				</T>
			</Box>
			<Box width={plan.priorityWidth} flexShrink={0} paddingLeft={1}>
				<T
					wrap="truncate-end"
					tone={task.isDone ? 'muted' : PRIORITY_TONE[task.priority]}
				>
					{priorityText}
				</T>
			</Box>
			<Box width={plan.dueWidth} flexShrink={0} paddingLeft={1}>
				<T wrap="truncate-end" tone={isLate ? 'warn' : 'muted'} bold={isLate}>
					{dueCell(task, today, plan.hasYear)}
				</T>
			</Box>
		</Box>
	);
}
