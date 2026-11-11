/**
A `Dialog` listing `THEME_NAMES` with descriptions. Moving previews the theme (`previewTheme`), Enter
commits it (`selectTheme`), Esc cancels the preview. The preview also ends when the dialog unmounts.
*/
import {useEffect, useLayoutEffect, useRef} from 'react';
import {Box} from 'ink';
import {THEMES} from '../../theme/palettes.js';
import {THEME_NAMES, type ThemeName} from '../../theme/tokens.js';
import {useListNav} from '../../ui/hooks/index.js';
import {useKeys, type KeyBinding} from '../../ui/input/index.js';
import {Dialog, FOCUS_MARKER, T, type KeyHint} from '../../ui/kit/index.js';
import {useScreenSize, useSettings} from '../context.js';

export type ThemePickerProps = {
	readonly onClose: () => void;
};

/**
One line per theme, shown beside its name.
*/
export const THEME_DESCRIPTIONS: Readonly<Record<ThemeName, string>> = {
	amber: 'Warm phosphor glow',
	green: 'Classic green screen',
	severance: 'Cold blue, on a dark field',
};

const CANCEL_BINDINGS: ReadonlyArray<KeyBinding<'cancel'>> = [
	{action: 'cancel', keys: ['esc', 't'], label: 'cancel', group: 'Themes'},
];

const HINTS: readonly KeyHint[] = [
	{keys: '↑↓', label: 'preview'},
	{keys: 'enter', label: 'choose'},
	{keys: 'esc', label: 'cancel'},
];

const WIDTH = 52;
const MIN_WIDTH = 24;
const MARGIN = 2;

function PickerBody({onClose}: ThemePickerProps) {
	const settings = useSettings();
	// The settings object is rebuilt on every change; effects read the latest through a ref.
	const latestRef = useRef(settings);
	useLayoutEffect(() => {
		latestRef.current = settings;
	});
	const {theme} = settings;
	const {cursor} = useListNav({
		selectLabel: 'choose',
		count: THEME_NAMES.length,
		initialCursor: Math.max(0, THEME_NAMES.indexOf(theme)),
		onSelect(index) {
			const name = THEME_NAMES[index];
			if (name !== undefined) {
				latestRef.current.selectTheme(name);
			}

			onClose();
		},
	});
	useKeys(CANCEL_BINDINGS, {
		cancel() {
			latestRef.current.previewTheme(undefined);
			onClose();
		},
	});
	const cursorName = THEME_NAMES[cursor];
	useEffect(() => {
		latestRef.current.previewTheme(cursorName);
	}, [cursorName]);
	useEffect(
		() => () => {
			latestRef.current.previewTheme(undefined);
		},
		[],
	);

	const labelWidth = Math.max(
		...THEME_NAMES.map(name => THEMES[name].label.length),
	);
	return (
		<Box flexDirection="column">
			{THEME_NAMES.map(name => {
				const isCursor = name === cursorName;
				return (
					<Box key={name} flexShrink={0}>
						<T wrap="truncate-end">
							<T bold={isCursor} inverse={isCursor} tone="accent">
								{isCursor ? `${FOCUS_MARKER} ` : '  '}
								{THEMES[name].label.padEnd(labelWidth)}
							</T>
							<T tone="muted">
								{`  ${THEME_DESCRIPTIONS[name]}`}
								{name === theme ? ' (current)' : ''}
							</T>
						</T>
					</Box>
				);
			})}
		</Box>
	);
}

export function ThemePicker({onClose}: ThemePickerProps) {
	const size = useScreenSize();
	const width = Math.max(MIN_WIDTH, Math.min(WIDTH, size.columns - MARGIN));
	return (
		<Dialog
			id="themes"
			title="Theme"
			width={width}
			height={THEME_NAMES.length + 2}
			hints={HINTS}
		>
			<PickerBody onClose={onClose} />
		</Dialog>
	);
}
