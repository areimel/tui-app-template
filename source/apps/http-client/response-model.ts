/**
Pure response model: cleaning what the server sent, content detection (JSON tree or text), sorted
headers, raw text and hard wrapping into scrollable rows.
*/
import {sanitizeLine, sanitizeText} from '../../core/sanitize.js';
import type {HttpError, HttpResponse} from '../../platform/types.js';
import {jsonToTree} from '../../ui/kit/tree-model.js';
import type {TreeNode, TreeRow} from '../../ui/kit/types.js';

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

/**
The response with everything the server controls made safe to draw: status text, header names and
values (one line each) and the body (escape sequences and controls removed, newlines kept). Applied
once, as the response arrives; everything below works on the clean copy.
*/
export function cleanResponse(response: HttpResponse): HttpResponse {
	return {
		...response,
		statusText: sanitizeLine(response.statusText),
		headers: Object.fromEntries(
			Object.entries(response.headers).map(([name, value]) => [
				sanitizeLine(name),
				sanitizeLine(value),
			]),
		),
		body: sanitizeText(response.body),
	};
}

/**
A transport error safe to draw (its message may quote the server or the URL).
*/
export function cleanError(error: HttpError): HttpError {
	return {...error, message: sanitizeLine(error.message)};
}

/**
Lines of `text` hard-wrapped to `width` cells (at least 1), at most `MAX_TEXT_ROWS`; empty lines are
one space so they keep a row.
*/
export function wrapRows(text: string, width: number): string[] {
	const size = Math.max(1, width);
	const rows: string[] = [];
	for (const line of text.slice(0, MAX_TEXT_CHARS).split('\n')) {
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
