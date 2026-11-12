import {Box} from 'ink';
import {T} from './T.js';
import {tabsWindow} from './tabs-window.js';
import type {TabsProps} from './types.js';

/**
One-row tab strip (see `TabsProps`). The selected tab is bracketed, bold and inverse; the rest are
padded to the same width of marks so the strip does not shift when the selection moves. With a
`width` too small for every tab, a window around the selection is drawn between `‹` / `›` markers.
*/
export function Tabs<V extends string>({
	tabs,
	value,
	isFocused = false,
	width,
}: TabsProps<V>) {
	const selected = Math.max(
		0,
		tabs.findIndex(tab => tab.value === value),
	);
	const window = tabsWindow(
		tabs.map(tab => tab.label),
		selected,
		width,
	);
	const shown = tabs.slice(window.start, window.end);
	return (
		<Box flexShrink={0}>
			{window.hasMarkers ? (
				<T tone="muted">{window.start > 0 ? '‹' : ' '}</T>
			) : null}
			{shown.map(tab => {
				const isSelected = tab.value === value;
				return (
					<T
						key={tab.value}
						bold={isSelected}
						inverse={isSelected && isFocused}
						tone={isSelected ? 'accent' : 'muted'}
						wrap="truncate-end"
					>
						{isSelected ? `[ ${tab.label} ]` : `  ${tab.label}  `}
					</T>
				);
			})}
			{window.hasMarkers ? (
				<T tone="muted">{window.end < tabs.length ? '›' : ' '}</T>
			) : null}
		</Box>
	);
}
