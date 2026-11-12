/**
Keep Awake's key tables (data: dispatch, footer hints and help all read them). Only app keys live
here: quit, back, help and themes are the shell's globals (`shell/global-bindings.ts`), so the footer
shows them next to these. Footer priority (`hint`, lower is kept longer): quit 0, back 1, help 2,
pause or new session 3, themes 4, move 5, edit 6, change 7, animation 8.
*/
import type {KeyBinding} from '../../ui/input/types.js';
import type {SessionPhase} from './session/types.js';

export type SessionAction = 'togglePause' | 'restart' | 'toggleAnimation';

export type OptionsAction = 'up' | 'down' | 'decrease' | 'increase' | 'edit';

const ANIMATION: KeyBinding<SessionAction> = {
	action: 'toggleAnimation',
	keys: ['a'],
	label: 'animation',
	hint: 8,
	group: 'Session',
};

/**
The session keys for the current phase: space pauses or resumes a running session, `r` starts a new
one once it has stopped, `a` always toggles the steam.
*/
export function sessionBindings(
	phase: SessionPhase,
): ReadonlyArray<KeyBinding<SessionAction>> {
	if (phase === 'stopped') {
		return [
			{
				action: 'restart',
				keys: ['r'],
				label: 'new session',
				hint: 3,
				group: 'Session',
			},
			ANIMATION,
		];
	}

	if (phase === 'unsupported') {
		return [ANIMATION];
	}

	return [
		{
			action: 'togglePause',
			keys: ['space'],
			label: phase === 'paused' ? 'resume' : 'pause',
			hint: 3,
			group: 'Session',
		},
		ANIMATION,
	];
}

export const OPTIONS_BINDINGS: ReadonlyArray<KeyBinding<OptionsAction>> = [
	{
		action: 'up',
		keys: ['up', 'k'],
		label: 'move',
		caption: '↑↓',
		hint: 5,
		group: 'Options',
	},
	{action: 'down', keys: ['down', 'j'], label: 'move', group: 'Options'},
	{
		action: 'decrease',
		keys: ['left'],
		label: 'change',
		caption: '←→',
		hint: 7,
		group: 'Options',
	},
	{
		action: 'increase',
		keys: ['right'],
		label: 'change',
		group: 'Options',
	},
	{
		action: 'edit',
		keys: ['enter'],
		label: 'edit',
		hint: 6,
		group: 'Options',
	},
];

/**
Everything the screen can register, for the help overlay (`AppDefinition.bindings`).
*/
export const KEEP_AWAKE_BINDINGS: readonly KeyBinding[] = [
	{
		action: 'togglePause',
		keys: ['space'],
		label: 'pause or resume',
		group: 'Session',
	},
	{
		action: 'restart',
		keys: ['r'],
		label: 'new session (after it stopped)',
		group: 'Session',
	},
	{
		action: 'toggleAnimation',
		keys: ['a'],
		label: 'animation',
		group: 'Session',
	},
	...OPTIONS_BINDINGS,
];
