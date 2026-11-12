import {T} from './T.js';
import type {ToastProps} from './types.js';

const GLYPHS = {ok: '✓', warn: '!', err: '✗'} as const;

/**
A short toned message (see `ToastProps`). One row: longer text is truncated.
*/
export function Toast({text, tone = 'ok'}: ToastProps) {
	return (
		<T tone={tone} wrap="truncate-end">
			{GLYPHS[tone]} {text}
		</T>
	);
}
