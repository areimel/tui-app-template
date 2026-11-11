/**
Row counts of each dashboard region as rendered, computed from the same models the components draw, so `planDashboard` can fit them before rendering. Every glyph used is one cell wide, so string length is cell width.
*/
import type {SessionState} from '../core/session/types.js';
import {
	type OptionContext,
	type OptionField,
	OPTION_FIELDS,
} from '../features/options/option-fields.js';
import type {StatLine} from '../features/stats/stats-model.js';
import {buildStatus} from '../features/status/status-model.js';
import {THEMES} from '../theme/palettes.js';
import {THEME_NAMES} from '../theme/tokens.js';
import {PANEL_CHROME_COLUMNS, PANEL_CHROME_ROWS} from './dashboard-plan.js';

export {PANEL_CHROME_COLUMNS} from './dashboard-plan.js';
/**
`SessionStatus` label column (8) plus its gap.
*/
const STATUS_LABEL_COLUMNS = 9;
/**
`FieldRow` gutter (2) plus the gap after the label.
*/
const FIELD_ROW_CHROME = 3;
/**
`StatsPanel` bar width plus its gap.
*/
const STATS_BAR_COLUMNS = 11;
/**
Brackets and padding around a value: `[ ‹ … › ]`.
*/
const CONTROL_CHROME = 8;

/**
Rows that `text` takes when word-wrapped at `width` cells.
*/
export function wrappedRows(text: string, width: number): number {
	const limit = Math.max(1, width);
	let rows = 1;
	let column = 0;
	for (const word of text.split(' ')) {
		const needed = column === 0 ? word.length : column + 1 + word.length;
		if (needed <= limit) {
			column = needed;
			continue;
		}

		if (column > 0) {
			rows++;
		}

		const extra = Math.max(0, Math.floor((word.length - 1) / limit));
		rows += extra;
		const wrapped = extra * limit;
		column = word.length - wrapped;
	}

	return rows;
}

const inner = (width: number) => width - PANEL_CHROME_COLUMNS;

/**
Height of the Session panel (`Panel` + `SessionStatus`) at `width`.
*/
export function sessionPanelHeight(
	state: SessionState,
	now: number,
	width: number,
): number {
	const model = buildStatus(state, now);
	const text = inner(width);
	const value = text - STATUS_LABEL_COLUMNS;
	let rows = PANEL_CHROME_ROWS + 2; // Phase badge and its margin.
	rows += wrappedRows(model.elapsed, value) + wrappedRows(model.ends, value);
	rows += model.pid === undefined ? 0 : 1;
	rows += 1; // Margin above the lock badges.
	for (const lock of model.locks) {
		rows += wrappedRows(`● ${lock.label} ${lock.detail ?? ''}`, text);
	}

	if (model.message !== undefined) {
		rows += 1 + wrappedRows(model.message, text);
	}

	for (const note of model.notes) {
		rows += wrappedRows(note, text);
	}

	return rows;
}

/**
Label column width that aligns every option label.
*/
export const OPTION_LABEL_WIDTH = Math.max(
	...OPTION_FIELDS.map(field => field.label.length),
);

function fieldRows(
	field: OptionField,
	options: SessionState['options'],
	context: OptionContext,
	width: number,
): number {
	const hint = field.disabledReason(context);
	if (hint === undefined) {
		return 1;
	}

	const used =
		FIELD_ROW_CHROME +
		OPTION_LABEL_WIDTH +
		field.display(options).length +
		CONTROL_CHROME;
	return wrappedRows(hint, width - used - 1);
}

/**
Height of the Options panel (`Panel` + `OptionsEditor`) at `width`.
*/
export function optionsPanelHeight(
	options: SessionState['options'],
	context: OptionContext,
	width: number,
): number {
	let rows = PANEL_CHROME_ROWS;
	for (const field of OPTION_FIELDS) {
		if (field.isVisible(options)) {
			rows += fieldRows(field, options, context, inner(width));
		}
	}

	return rows;
}

/**
Height of a panel holding `lines` (each wrapped at the panel's inner width).
*/
export function linesPanelHeight(
	lines: readonly string[],
	width: number,
): number {
	return lines.reduce(
		(rows, line) => rows + wrappedRows(line, inner(width)),
		PANEL_CHROME_ROWS,
	);
}

/**
Height of `HelpOverlay`: one row per binding, the note line and the close hint.
*/
export function helpPanelHeight(
	bindings: ReadonlyArray<{keys: string; label: string}>,
	width: number,
): number {
	const keyWidth = Math.max(0, ...bindings.map(({keys}) => keys.length));
	return linesPanelHeight(
		[
			...bindings.map(({label}) => `${'k'.repeat(keyWidth)} ${label}`),
			'The app exits when a stop condition is met. Space pauses.',
			'Esc close',
		],
		width,
	);
}

/**
Height of `ThemePicker`: one row per theme (its hints are at most this long).
*/
const THEME_HINT_SAMPLE = 'old-school green phosphor';

export function themePickerHeight(width: number): number {
	return linesPanelHeight(
		THEME_NAMES.map(name => `❯ ● ${THEMES[name].label} ${THEME_HINT_SAMPLE}`),
		width,
	);
}

/**
Natural width of the Stats panel for these lines, border included.
*/
export function statsPanelWidth(lines: readonly StatLine[]): number {
	const labelWidth = Math.max(0, ...lines.map(({label}) => label.length));
	const content = Math.max(
		'Stats'.length,
		...lines.map(
			line =>
				labelWidth +
				1 +
				line.value.length +
				(line.bar === undefined ? 0 : STATS_BAR_COLUMNS),
		),
	);
	return content + PANEL_CHROME_COLUMNS;
}

/**
Stat lines dropped first when space is short, in order.
*/
export const STATS_DROP_ORDER: readonly string[] = [
	'host',
	'session',
	'draw',
	'load',
	'uptime',
];

/**
The `count` most important lines, keeping display order.
*/
export function trimStats(
	lines: readonly StatLine[],
	count: number,
): StatLine[] {
	const dropped = new Set<string>();
	for (const id of STATS_DROP_ORDER) {
		if (lines.length - dropped.size <= count) {
			break;
		}

		if (lines.some(line => line.id === id)) {
			dropped.add(id);
		}
	}

	return lines.filter(line => !dropped.has(line.id));
}

/**
Fewest lines `trimStats` can reach.
*/
export function minStatsCount(lines: readonly StatLine[]): number {
	return lines.filter(line => !STATS_DROP_ORDER.includes(line.id)).length;
}
