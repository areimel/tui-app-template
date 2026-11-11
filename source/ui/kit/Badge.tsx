import {Box} from 'ink';
import type {TokenName} from '../../theme/tokens.js';
import {T} from './T.js';

export type BadgeState = 'ok' | 'warn' | 'err' | 'off';

export type BadgeProps = {
	readonly state: BadgeState;
	readonly label: string;
	/**
	Muted trailing detail, e.g. the lock method in use.
	*/
	readonly detail?: string;
};

const GLYPHS: Record<BadgeState, string> = {
	ok: '●',
	warn: '▲',
	err: '✕',
	off: '○',
};

const TONES: Record<BadgeState, TokenName> = {
	ok: 'ok',
	warn: 'warn',
	err: 'err',
	off: 'muted',
};

/**
Status pill: glyph + label (+ detail); the glyph differs per state, not only the colour.
*/
export function Badge({state, label, detail}: BadgeProps) {
	return (
		<Box>
			<T tone={TONES[state]}>
				{GLYPHS[state]} {label}
			</T>
			{detail === undefined ? null : <T tone="muted"> {detail}</T>}
		</Box>
	);
}
