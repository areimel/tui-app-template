import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {T} from './T.js';

export type SelectItem<V extends string> = {
	readonly value: V;
	readonly label: string;
	readonly hint?: string;
};

export type SelectListProps<V extends string> = {
	readonly items: ReadonlyArray<SelectItem<V>>;
	/**
	The committed selection (shown `●`, others `○`).
	*/
	readonly value: V;
	/**
	The row under the cursor (shown with the focus marker while `isFocused`).
	*/
	readonly highlighted: V;
	/**
	Show the cursor. Default false: an unfocused list shows only the committed mark.
	*/
	readonly isFocused?: boolean;
};

/**
Presentational list; the parent owns key handling.
*/
export function SelectList<V extends string>({
	items,
	value,
	highlighted,
	isFocused = false,
}: SelectListProps<V>) {
	return (
		<Box flexDirection="column">
			{items.map(item => {
				const isCursor = isFocused && item.value === highlighted;
				const isCommitted = item.value === value;
				return (
					<Box key={item.value}>
						<T bold tone="accent">
							{isCursor ? `${FOCUS_MARKER} ` : '  '}
						</T>
						<T bold={isCursor} tone={isCommitted ? 'accent' : 'text'}>
							{isCommitted ? '● ' : '○ '}
							{item.label}
						</T>
						{item.hint === undefined ? null : <T tone="muted"> {item.hint}</T>}
					</Box>
				);
			})}
		</Box>
	);
}
