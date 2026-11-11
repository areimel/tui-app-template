/**
Pure model of the help overlay: key bindings grouped into sections, then flattened to rows.
*/
import {textWidth} from '../../core/text-width.js';
import {formatKey} from '../../ui/input/keys.js';
import type {KeyBinding} from '../../ui/input/types.js';

export type HelpRow = {
	/**
	Every key of the binding, formatted (`↑, k`).
	*/
	readonly keys: string;
	readonly label: string;
};

export type HelpSection = {
	readonly title: string;
	readonly rows: readonly HelpRow[];
};

/**
One line of the flattened help: a section heading, a binding, or a blank separator.
*/
export type HelpLine =
	| {readonly kind: 'heading'; readonly text: string}
	| {readonly kind: 'row'; readonly keys: string; readonly label: string}
	| {readonly kind: 'blank'};

export const GLOBAL_SECTION = 'Global';

type HelpInput = {
	/**
	What the current screen registered (`useActiveBindings().screen`).
	*/
	readonly screen: readonly KeyBinding[];
	/**
	The app's declared `bindings`, listed even when not mounted; duplicates of `screen` are dropped.
	*/
	readonly declared?: readonly KeyBinding[];
	readonly global: readonly KeyBinding[];
	/**
	Section for screen bindings without a `group` (the app title, or `Menu`).
	*/
	readonly screenTitle: string;
};

const identity = (binding: KeyBinding) =>
	`${binding.action}\u{0}${binding.keys.join(',')}\u{0}${binding.label}`;

function toRow(binding: KeyBinding): HelpRow {
	return {
		keys: binding.keys.map(key => formatKey(key)).join(', '),
		label: binding.label,
	};
}

/**
Sections in first-seen order: the screen's groups, then the globals'. Bindings with the same group
title share a section.
*/
export function helpSections({
	screen,
	declared = [],
	global,
	screenTitle,
}: HelpInput): HelpSection[] {
	const sections = new Map<string, HelpRow[]>();
	const seen = new Set<string>();
	const add = (binding: KeyBinding, fallbackTitle: string) => {
		const id = identity(binding);
		if (seen.has(id)) {
			return;
		}

		seen.add(id);
		const title = binding.group ?? fallbackTitle;
		sections.set(title, [...(sections.get(title) ?? []), toRow(binding)]);
	};

	for (const binding of [...screen, ...declared]) {
		add(binding, screenTitle);
	}

	for (const binding of global) {
		add(binding, GLOBAL_SECTION);
	}

	return [...sections].map(([title, rows]) => ({title, rows}));
}

/**
Flat lines for a scrolling list: a heading, its rows, a blank line between sections. Key captions are
padded to one column so labels line up.
*/
export function helpLines(sections: readonly HelpSection[]): HelpLine[] {
	const keyWidth = Math.max(
		0,
		...sections.flatMap(section =>
			section.rows.map(row => textWidth(row.keys)),
		),
	);
	const lines: HelpLine[] = [];
	for (const [index, section] of sections.entries()) {
		if (index > 0) {
			lines.push({kind: 'blank'});
		}

		lines.push({kind: 'heading', text: section.title});
		for (const row of section.rows) {
			lines.push({
				kind: 'row',
				keys: row.keys.padEnd(keyWidth),
				label: row.label,
			});
		}
	}

	return lines;
}
