/**
Shared wrapper for one gallery sample: a one-line caption naming the kit component, then the sample.
*/
import type {ReactNode} from 'react';
import {Box} from 'ink';
import {T} from '../../ui/kit/index.js';

export type SampleProps = {
	/**
	The kit component (or group) shown, in the caption.
	*/
	readonly name: string;
	/**
	What it is, one short line.
	*/
	readonly note: string;
	readonly children?: ReactNode;
};

export function Sample({name, note, children}: SampleProps) {
	return (
		<Box flexDirection="column" flexShrink={0} marginBottom={1}>
			<T wrap="truncate-end">
				<T bold tone="accent">
					{name}
				</T>
				<T tone="muted"> {note}</T>
			</T>
			{children}
		</Box>
	);
}

/**
A row of small items that wraps onto more rows when the body is narrow.
*/
export function Wrap({children}: {readonly children?: ReactNode}) {
	return (
		<Box flexWrap="wrap" columnGap={2}>
			{children}
		</Box>
	);
}
