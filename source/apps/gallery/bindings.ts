/**
Gallery key tables (the definition lists them for help; `Screen` registers them).
*/
import type {KeyBinding} from '../../ui/input/index.js';

export type TabAction = 'previousTab' | 'nextTab';
export type ThemeAction = 'previousTheme' | 'nextTheme';
export type InsideAction = 'enter' | 'leave';

export const TAB_BINDINGS: ReadonlyArray<KeyBinding<TabAction>> = [
	{
		action: 'previousTab',
		keys: ['left', 'h'],
		label: 'previous tab',
		caption: '←→',
		hintLabel: 'tab',
		hint: 1,
		group: 'Gallery',
	},
	{
		action: 'nextTab',
		keys: ['right', 'l'],
		label: 'next tab',
		group: 'Gallery',
	},
];

export const THEME_BINDINGS: ReadonlyArray<KeyBinding<ThemeAction>> = [
	{
		action: 'previousTheme',
		keys: ['['],
		label: 'previous theme',
		caption: '[ ]',
		hintLabel: 'theme',
		hint: 2,
		group: 'Gallery',
	},
	{action: 'nextTheme', keys: [']'], label: 'next theme', group: 'Gallery'},
];

export const ENTER_BINDINGS: ReadonlyArray<KeyBinding<'enter'>> = [
	{
		action: 'enter',
		keys: ['enter', 'space'],
		label: 'try it',
		caption: 'enter',
		hint: 3,
		group: 'Gallery',
	},
];

export const LEAVE_BINDINGS: ReadonlyArray<KeyBinding<'leave'>> = [
	{
		action: 'leave',
		keys: ['esc'],
		label: 'leave the sample',
		hint: 1,
		group: 'Gallery',
	},
];

/**
Everything above, for `AppDefinition.bindings`. Up/down/PageUp/PageDown scroll the page (`useScroll`).
*/
export const GALLERY_BINDINGS: readonly KeyBinding[] = [
	...TAB_BINDINGS,
	...THEME_BINDINGS,
	...ENTER_BINDINGS,
	...LEAVE_BINDINGS,
];
