/**
Pure response model: size and time labels, content detection (JSON tree or text), sorted headers, raw
text and hard wrapping into scrollable rows.
*/
import type {HttpResponse} from '../../platform/types.js';
import {jsonToTree} from '../../ui/kit/tree-model.js';
import type {TreeNode, TreeRow} from '../../ui/kit/types.js';
import {isControlCode} from './text-util.js';

export const MAX_TREE_CHARS = 500_000;
export const MAX_TEXT_ROWS = 2000;
const MAX_TEXT_CHARS = 200_000;

export type ResponseTab = 'body' | 'headers' | 'raw';

export const RESPONSE_TABS: ReadonlyArray<{
	readonly value: ResponseTab;
	readonly label: string;
}> = [
	{value: 'body', label: 'Body'},
	{value: 'headers', label: 'Headers'},
	{value: 'raw', label: 'Raw'},
];

export function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	return bytes < 1024 * 1024
		? `${(bytes / 1024).toFixed(1)} KB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
`240 ms` below a second, else `1.25 s`.
*/
export function formatMillis(ms: number): string {
	const rounded = Math.max(0, Math.round(ms));
	return rounded < 1000 ? `${rounded} ms` : `${(rounded / 1000).toFixed(2)} s`;
}

/**
Elapsed time while waiting: `0.4 s`.
*/
export function formatWaiting(ms: number): string {
	return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

/**
Replaces tabs and drops control characters (ANSI escapes in a body must not reach the terminal).
*/
export function sanitizeText(text: string): string {
	return [...text.replaceAll('\t', '  ').replaceAll('\r\n', '\n')]
		.filter(
			character =>
				character === '\n' || !isControlCode(character.codePointAt(0)),
		)
		.join('');
}

/**
Lines of `text` hard-wrapped to `width` cells (at least 1), at most `MAX_TEXT_ROWS`; empty lines are
one space so they keep a row.
*/
export function wrapRows(text: string, width: number): string[] {
	const size = Math.max(1, width);
	const rows: string[] = [];
	for (const line of sanitizeText(text.slice(0, MAX_TEXT_CHARS)).split('\n')) {
		const characters = [...line];
		if (characters.length === 0) {
			rows.push(' ');
		}

		for (let start = 0; start < characters.length; start += size) {
			rows.push(characters.slice(start, start + size).join(''));
		}

		if (rows.length >= MAX_TEXT_ROWS) {
			return [...rows.slice(0, MAX_TEXT_ROWS), '… (output cut)'];
		}
	}

	return rows;
}

export type BodyView =
	| {readonly kind: 'tree'; readonly nodes: readonly TreeNode[]}
	| {readonly kind: 'text'; readonly text: string};

/**
A JSON object or array body is a tree; anything else (HTML, plain text, a bare JSON scalar, a huge
body) is text.
*/
export function bodyView(response: HttpResponse): BodyView {
	const trimmed = response.body.trim();
	if (trimmed === '') {
		return {kind: 'text', text: '(empty body)'};
	}

	if (
		trimmed.length <= MAX_TREE_CHARS &&
		(trimmed.startsWith('{') || trimmed.startsWith('['))
	) {
		try {
			const value: unknown = JSON.parse(trimmed);
			if (typeof value === 'object' && value !== null) {
				const nodes = jsonToTree(value);
				if (nodes.length > 0) {
					return {kind: 'tree', nodes};
				}
			}
		} catch {
			// Not JSON: shown as text.
		}
	}

	return {kind: 'text', text: response.body};
}

/**
Header rows sorted by name (the client lower-cases names).
*/
export function sortedHeaders(
	headers: Readonly<Record<string, string>>,
): ReadonlyArray<readonly [string, string]> {
	return Object.entries(headers).toSorted(([a], [b]) => a.localeCompare(b));
}

const MAX_NAME_COLUMN = 24;

/**
`name  value` text for the Headers tab, names padded to one column.
*/
export function headersText(headers: Readonly<Record<string, string>>): string {
	const sorted = sortedHeaders(headers);
	if (sorted.length === 0) {
		return '(no headers)';
	}

	const column = Math.min(
		MAX_NAME_COLUMN,
		Math.max(...sorted.map(([name]) => name.length)),
	);
	return sorted
		.map(([name, value]) => `${name.padEnd(column)}  ${value}`)
		.join('\n');
}

/**
The Raw tab: status line, sorted headers, a blank line and the body as received.
*/
export function rawText(response: HttpResponse): string {
	const head = [
		`HTTP ${response.status} ${response.statusText}`.trim(),
		...sortedHeaders(response.headers).map(
			([name, value]) => `${name}: ${value}`,
		),
	];
	return `${head.join('\n')}\n\n${response.body}`;
}

// ---- Tree helpers ----------------------------------------------------------------------------------

function collectParents(
	nodes: readonly TreeNode[],
	depthLimit: number,
	depth = 0,
): string[] {
	return nodes.flatMap(node => {
		const children = node.children ?? [];
		if (children.length === 0) {
			return [];
		}

		return [
			node.id,
			...(depth + 1 < depthLimit
				? collectParents(children, depthLimit, depth + 1)
				: []),
		];
	});
}

/**
Ids of the top-level containers: what is open when a response first shows.
*/
export function topLevelParents(nodes: readonly TreeNode[]): Set<string> {
	return new Set(collectParents(nodes, 1));
}

/**
Ids of every container (expand all).
*/
export function allParents(nodes: readonly TreeNode[]): Set<string> {
	return new Set(collectParents(nodes, Infinity));
}

/**
Index of the row's parent in the visible rows, `undefined` for a top-level row.
*/
export function parentIndex(
	rows: readonly TreeRow[],
	index: number,
): number | undefined {
	const row = rows[index];
	if (row === undefined || row.depth === 0) {
		return undefined;
	}

	for (let at = index - 1; at >= 0; at--) {
		if ((rows[at]?.depth ?? Infinity) < row.depth) {
			return at;
		}
	}

	return undefined;
}
