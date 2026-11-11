/**
The history dialog: the last requests, Enter loads one back into the form.
*/
import {Box} from 'ink';
import {useListNav} from '../../ui/hooks/index.js';
import {useKeys} from '../../ui/input/index.js';
import {Dialog, FOCUS_MARKER, T} from '../../ui/kit/index.js';
import type {HistoryEntry} from './request-model.js';

export type HistoryDialogProps = {
	readonly entries: readonly HistoryEntry[];
	readonly width: number;
	readonly onLoad: (entry: HistoryEntry) => void;
	readonly onClose: () => void;
};

const HINTS = [
	{keys: '↑↓', label: 'move'},
	{keys: 'enter', label: 'load'},
	{keys: 'esc', label: 'close'},
];

function rowText(entry: HistoryEntry, max: number): string {
	const text = `${entry.method.padEnd(6)} ${String(entry.status ?? '---')}  ${entry.url}`;
	const characters = [...text];
	return characters.length <= max
		? text
		: `${characters.slice(0, max - 1).join('')}…`;
}

/**
The list inside the dialog: it must be a child of `Dialog` so its keys register in the modal scope.
*/
function HistoryList({entries, width, onLoad, onClose}: HistoryDialogProps) {
	const nav = useListNav({
		count: entries.length,
		onSelect(index) {
			const entry = entries[index];
			if (entry !== undefined) {
				onLoad(entry);
			}
		},
	});
	useKeys(
		[{action: 'close', keys: ['esc', 'h'], label: 'close', group: 'History'}],
		{close: onClose},
	);
	const textWidth = Math.max(8, width - 4 - 2);
	return (
		<Box flexDirection="column">
			{entries.length === 0 ? (
				<T tone="muted">No requests sent yet.</T>
			) : (
				entries.map((entry, index) => {
					const isCursor = index === nav.cursor;
					return (
						<Box
							key={`${entry.method} ${entry.url} ${entry.header} ${entry.body}`}
						>
							<T bold tone="accent">
								{isCursor ? `${FOCUS_MARKER} ` : '  '}
							</T>
							<T bold={isCursor} wrap="truncate-end">
								{rowText(entry, textWidth)}
							</T>
						</Box>
					);
				})
			)}
		</Box>
	);
}

export function HistoryDialog(props: HistoryDialogProps) {
	return (
		<Dialog title="History" width={props.width} hints={HINTS} id="http-history">
			<HistoryList {...props} />
		</Dialog>
	);
}
