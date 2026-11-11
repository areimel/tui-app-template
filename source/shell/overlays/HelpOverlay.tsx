/**
A `Dialog` listing key bindings by `group`: the current screen's (`useActiveBindings().screen`, plus the
app's declared `bindings`) and the globals. Scrolls when too tall. Esc or `?` closes it.
*/
import {useMemo} from 'react';
import {Box} from 'ink';
import {useScroll} from '../../ui/hooks/index.js';
import {
	useActiveBindings,
	useKeys,
	type KeyBinding,
} from '../../ui/input/index.js';
import {
	Dialog,
	optionalProp,
	ScrollView,
	T,
	type KeyHint,
} from '../../ui/kit/index.js';
import {useScreenSize} from '../context.js';
import type {AppDefinition} from '../types.js';
import {helpLines, helpSections, type HelpLine} from './help-model.js';

export type HelpOverlayProps = {
	/**
	The app on screen (`undefined` on the menu).
	*/
	readonly app: AppDefinition | undefined;
	readonly onClose: () => void;
};

type CloseAction = 'close';

const CLOSE_BINDINGS: ReadonlyArray<KeyBinding<CloseAction>> = [
	{
		action: 'close',
		keys: ['esc', '?'],
		label: 'close',
		hint: 0,
		group: 'Help',
	},
];

const HINTS: readonly KeyHint[] = [
	{keys: 'esc', label: 'close'},
	{keys: '↑↓', label: 'scroll'},
];

const MAX_WIDTH = 56;
const MIN_WIDTH = 20;
/**
Dialog rows besides the content: the title and bottom borders.
*/
const BORDER_ROWS = 2;
/**
Body rows kept free around the dialog.
*/
const MARGIN_ROWS = 2;

function HelpLineRow({line}: {readonly line: HelpLine}) {
	switch (line.kind) {
		case 'blank': {
			return <T> </T>;
		}

		case 'heading': {
			return (
				<T bold tone="accent" wrap="truncate-end">
					{line.text}
				</T>
			);
		}

		case 'row': {
			return (
				<T wrap="truncate-end">
					<T bold tone="accent">
						{line.keys}
					</T>
					{'  '}
					<T>{line.label}</T>
				</T>
			);
		}
	}
}

type HelpBodyProps = {
	readonly lines: readonly HelpLine[];
	readonly viewportRows: number;
	readonly onClose: () => void;
};

/**
Inside the dialog, so its keys belong to the modal scope.
*/
function HelpBody({lines, viewportRows, onClose}: HelpBodyProps) {
	useKeys(CLOSE_BINDINGS, {close: onClose});
	const {offset} = useScroll({
		contentRows: lines.length,
		viewportRows,
	});
	return (
		<ScrollView
			hasScrollbar
			height={viewportRows}
			offset={offset}
			contentRows={lines.length}
		>
			{lines.map((line, index) => (
				// eslint-disable-next-line @eslint-react/no-array-index-key -- Static list.
				<Box key={index} flexShrink={0}>
					<HelpLineRow line={line} />
				</Box>
			))}
		</ScrollView>
	);
}

export function HelpOverlay({app, onClose}: HelpOverlayProps) {
	const size = useScreenSize();
	const {screen, global} = useActiveBindings();
	const declared = app?.bindings;
	const screenTitle = app?.title ?? 'Menu';
	const lines = useMemo(
		() =>
			helpLines(
				helpSections({
					screen,
					global,
					screenTitle,
					...optionalProp('declared', declared),
				}),
			),
		[screen, global, screenTitle, declared],
	);
	const viewportRows = Math.max(
		1,
		Math.min(lines.length, size.rows - BORDER_ROWS - MARGIN_ROWS),
	);
	const width = Math.max(
		MIN_WIDTH,
		Math.min(MAX_WIDTH, size.columns - MARGIN_ROWS),
	);
	return (
		<Dialog
			id="help"
			title={app === undefined ? 'Help' : `Help: ${app.title}`}
			width={width}
			height={viewportRows + BORDER_ROWS}
			hints={HINTS}
		>
			<HelpBody lines={lines} viewportRows={viewportRows} onClose={onClose} />
		</Dialog>
	);
}
