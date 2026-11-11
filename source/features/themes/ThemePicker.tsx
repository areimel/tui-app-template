import {useInput} from 'ink';
import {THEMES} from '../../theme/palettes.js';
import {THEME_NAMES, type ThemeName} from '../../theme/tokens.js';
import {Panel, SelectList, type SelectItem} from '../../ui/kit/index.js';

export type ThemePickerProps = {
	readonly current: ThemeName;
	readonly isActive: boolean;
	readonly onPreview: (name: ThemeName) => void;
	readonly onSelect: (name: ThemeName) => void;
	readonly onCancel: () => void;
	readonly flexGrow?: number;
};

const HINTS: Record<ThemeName, string> = {
	amber: 'old-school amber phosphor',
	green: 'old-school green phosphor',
	severance: 'cool blue office terminal',
};

const ITEMS: ReadonlyArray<SelectItem<ThemeName>> = THEME_NAMES.map(name => ({
	value: name,
	label: THEMES[name].label,
	hint: HINTS[name],
}));

/**
Theme list; the parent applies `onPreview` live and restores on `onCancel`. The cursor follows `current`.
*/
export function ThemePicker({
	current,
	isActive,
	onPreview,
	onSelect,
	onCancel,
	flexGrow,
}: ThemePickerProps) {
	useInput(
		(input, key) => {
			const delta = input === 'k' || key.upArrow ? -1 : 0;
			const step = input === 'j' || key.downArrow ? 1 : delta;
			if (step !== 0) {
				const index = THEME_NAMES.indexOf(current) + step;
				const next = THEME_NAMES[index];
				if (next !== undefined) {
					onPreview(next);
				}
			} else if (key.return) {
				onSelect(current);
			} else if (key.escape) {
				onCancel();
			}
		},
		{isActive},
	);

	return (
		<Panel
			title="Theme"
			isFocused={isActive}
			{...(flexGrow === undefined ? {} : {flexGrow})}
		>
			<SelectList
				isFocused
				items={ITEMS}
				value={current}
				highlighted={current}
			/>
		</Panel>
	);
}
