/**
Pure date rules: real-calendar `YYYY-MM-DD` checks, the due field parser and overdue. Today is passed in.
*/
import {fail, ok, type Result} from '../../core/result.js';
import type {Task} from './tasks-model.js';

const DATE_SHAPE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/v;

/**
True for a real calendar date written `YYYY-MM-DD` (leap years honoured).
*/
export function isValidDate(value: string): boolean {
	const parts = DATE_SHAPE.exec(value)?.groups;
	if (parts === undefined) {
		return false;
	}

	const year = Number(parts['year']);
	const month = Number(parts['month']);
	const day = Number(parts['day']);
	const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const daysInMonth = [
		31,
		isLeap ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	][month - 1];
	return daysInMonth !== undefined && day >= 1 && day <= daysInMonth;
}

/**
Empty text means no due date; anything else must be a real `YYYY-MM-DD` date.
*/
export function parseDue(input: string): Result<string | undefined> {
	const value = input.trim();
	if (value === '') {
		return ok(undefined);
	}

	return isValidDate(value)
		? ok(value)
		: fail('Due must be a real date (YYYY-MM-DD) or empty.');
}

const pad = (value: number, length: number) =>
	String(value).padStart(length, '0');

/**
The local calendar date of a timestamp as `YYYY-MM-DD`.
*/
export function toDateString(timestamp: number): string {
	const date = new Date(timestamp);
	return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/**
An open task whose due date is before `today` (`YYYY-MM-DD`).
*/
export function isOverdue(task: Task, today: string): boolean {
	return !task.isDone && task.due !== undefined && task.due < today;
}
