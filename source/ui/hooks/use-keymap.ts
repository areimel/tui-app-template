import {useInput, type Key} from 'ink';
import type {KeyHint} from '../kit/KeyHints.js';

export type GlobalAction =
	| 'quit'
	| 'toggle-pause'
	| 'toggle-themes'
	| 'toggle-animation'
	| 'toggle-help'
	| 'cycle-theme';

/**
Short list for the bottom bar.
*/
export const GLOBAL_KEY_HINTS: readonly KeyHint[] = [
	{keys: '↑↓', label: 'move'},
	{keys: '←→', label: 'change'},
	{keys: 'enter', label: 'edit'},
	{keys: 'space', label: 'pause'},
	{keys: 't', label: 'theme'},
	{keys: '?', label: 'help'},
	{keys: 'q', label: 'quit'},
];

/**
Full list for the help overlay.
*/
export const ALL_KEY_BINDINGS: readonly KeyHint[] = [
	{keys: '↑↓', label: 'move'},
	{keys: 'j/k', label: 'move'},
	{keys: '←→', label: 'change'},
	{keys: 'enter', label: 'edit'},
	{keys: 'esc', label: 'cancel'},
	{keys: 'space', label: 'pause/resume'},
	{keys: 't', label: 'themes'},
	{keys: 'T', label: 'next theme'},
	{keys: 'a', label: 'animation'},
	{keys: '?', label: 'help'},
	{keys: 'q', label: 'quit'},
];

/**
Maps a key press to a global action. When disabled (a text field is being edited) only Ctrl+C counts.
*/
export function resolveGlobalKey(
	input: string,
	key: Pick<Key, 'ctrl'>,
	isEnabled: boolean,
): GlobalAction | undefined {
	if (input === 'c' && key.ctrl) {
		return 'quit';
	}

	if (!isEnabled || key.ctrl) {
		return undefined;
	}

	switch (input) {
		case 'q': {
			return 'quit';
		}

		case ' ': {
			return 'toggle-pause';
		}

		case 't': {
			return 'toggle-themes';
		}

		case 'T': {
			return 'cycle-theme';
		}

		case 'a': {
			return 'toggle-animation';
		}

		case '?': {
			return 'toggle-help';
		}

		default: {
			return undefined;
		}
	}
}

export type KeymapHandlers = {
	isEnabled: boolean;
	onQuit: () => void;
	onTogglePause: () => void;
	onToggleThemes: () => void;
	onToggleAnimation: () => void;
	onToggleHelp: () => void;
	onCycleTheme?: () => void;
};

/**
The single global key binding table, wired to Ink's `useInput`.
*/
export function useKeymap(handlers: KeymapHandlers): void {
	useInput((input, key) => {
		const action = resolveGlobalKey(input, key, handlers.isEnabled);
		if (action === undefined) {
			return;
		}

		switch (action) {
			case 'quit': {
				handlers.onQuit();
				break;
			}

			case 'toggle-pause': {
				handlers.onTogglePause();
				break;
			}

			case 'toggle-themes': {
				handlers.onToggleThemes();
				break;
			}

			case 'toggle-animation': {
				handlers.onToggleAnimation();
				break;
			}

			case 'toggle-help': {
				handlers.onToggleHelp();
				break;
			}

			case 'cycle-theme': {
				handlers.onCycleTheme?.();
				break;
			}
		}
	});
}
