import type {AsyncState} from '../../ui/hooks/types.js';
import {useScroll} from '../../ui/hooks/use-scroll.js';
import type {DirEntry, FilePreview} from '../../platform/types.js';
import {Panel, ScrollView, T} from '../../ui/kit/index.js';
import {previewLines, previewTitle} from './explorer-model.js';

export type PreviewResult = {
	readonly path: string;
	readonly preview: FilePreview;
};

export type PreviewPaneProps = {
	readonly entry: DirEntry | undefined;
	readonly state: AsyncState<PreviewResult, string>;
	/**
	Outer size, border included.
	*/
	readonly width: number;
	readonly height: number;
	readonly isFocused: boolean;
};

function TextBody({
	preview,
	width,
	rows,
	isFocused,
}: {
	readonly preview: Extract<FilePreview, {kind: 'text'}>;
	readonly width: number;
	readonly rows: number;
	readonly isFocused: boolean;
}) {
	const {lines, isCapped} = previewLines(preview.lines);
	const note = isCapped || preview.isTruncated ? ['… truncated'] : [];
	const content = [...lines, ...note];
	const numbered = content.map((line, id) => ({id, line}));
	const scroll = useScroll({
		contentRows: content.length,
		viewportRows: rows,
		isActive: isFocused,
	});
	if (content.length === 0) {
		return <T tone="muted">(empty file)</T>;
	}

	return (
		<ScrollView
			hasScrollbar
			height={rows}
			offset={scroll.offset}
			contentRows={content.length}
			width={width}
		>
			{numbered.map(row => (
				<T
					key={row.id}
					wrap="truncate-end"
					tone={row.id >= lines.length ? 'muted' : 'text'}
				>
					{row.line === '' ? ' ' : row.line}
				</T>
			))}
		</ScrollView>
	);
}

/**
The preview pane: text in a scrollable view, or a one-line summary for binary files, folders and errors.
*/
export function PreviewPane({
	entry,
	state,
	width,
	height,
	isFocused,
}: PreviewPaneProps) {
	const inner = width - 4;
	const rows = height - 2;
	const known =
		entry !== undefined &&
		state.status === 'done' &&
		state.value.path === entry.path
			? state.value.preview
			: undefined;

	let body;
	if (entry === undefined) {
		body = <T tone="muted">Nothing selected</T>;
	} else if (state.status === 'failed') {
		body = (
			<T tone="err" wrap="truncate-end">
				{`✗ ${state.error}`}
			</T>
		);
	} else if (known === undefined) {
		body = <T tone="muted">Loading…</T>;
	} else if (known.kind === 'text') {
		body = (
			<TextBody
				key={entry.path}
				preview={known}
				width={inner}
				rows={rows}
				isFocused={isFocused}
			/>
		);
	} else if (known.kind === 'binary') {
		body = <T tone="muted">{`binary file, ${known.sizeBytes} bytes`}</T>;
	} else {
		body = (
			<T tone="muted">
				{`directory, ${known.entryCount} ${known.entryCount === 1 ? 'item' : 'items'}`}
			</T>
		);
	}

	return (
		<Panel
			title={previewTitle(entry?.name ?? 'Preview', Math.max(1, inner - 4))}
			isFocused={isFocused}
			width={width}
			height={height}
		>
			{body}
		</Panel>
	);
}
