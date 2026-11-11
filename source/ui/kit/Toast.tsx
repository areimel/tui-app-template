/**
Stub: owned by K4 (indicators). Replace the body; keep the export name and props type.
*/
import {T} from './T.js';
import type {ToastProps} from './types.js';

const GLYPHS = {ok: '✓', warn: '!', err: '✗'} as const;

/**
A short toned message (see `ToastProps`).
*/
export function Toast({text, tone = 'ok'}: ToastProps) {
	return (
		<T tone={tone}>
			{GLYPHS[tone]} {text}
		</T>
	);
}
