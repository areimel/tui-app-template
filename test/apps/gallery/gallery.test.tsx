import test from 'ava';
import {Screen} from '../../../source/apps/gallery/Screen.js';
import {resolveByName} from '../../../source/theme/resolve.js';
import {PLAIN_THEME} from '../../../source/theme/context.js';
import {THEME_NAMES, type ResolvedTheme} from '../../../source/theme/tokens.js';
import {assertFits} from '../../helpers/assert-frame.js';
import {KEYS, renderScreen} from '../../helpers/render-screen.js';

/**
Caption text that appears at the top of each tab, in tab order.
*/
const TAB_MARKERS = [
	'Badge',
	'ProgressBar',
	'SelectList',
	'Table',
	'Toggle',
	'Form',
	'Dialog',
	'Panel',
] as const;

const THEMES: readonly ResolvedTheme[] = [
	PLAIN_THEME,
	...THEME_NAMES.map(name => resolveByName(name, 3)),
];

const SIZES = [
	{columns: 116, rows: 38},
	{columns: 76, rows: 22},
	{columns: 56, rows: 18},
	{columns: 36, rows: 10},
] as const;

async function showTab(
	view: ReturnType<typeof renderScreen>,
	index: number,
): Promise<void> {
	const marker = TAB_MARKERS[index] ?? '';
	await view.waitForText(marker);
	await view.press('l');
}

test('every tab renders in every theme', async t => {
	let visited = 0;
	for (const theme of THEMES) {
		const view = renderScreen(<Screen />, {columns: 100, rows: 30, theme});
		for (let index = 0; index < TAB_MARKERS.length; index++) {
			// eslint-disable-next-line no-await-in-loop -- Tabs are visited in order.
			await showTab(view, index);
		}

		visited++;
		view.unmount();
	}

	t.is(visited, THEMES.length);
});

test('left and right switch tabs and wrap around', async t => {
	const view = renderScreen(<Screen />);
	await view.waitForText('Badge');
	await view.press(KEYS.right);
	await view.waitForText('ProgressBar');
	await view.press(KEYS.left, KEYS.left);
	await view.waitForText('Layout 8/8');
	t.true(view.plainFrame().includes('[ Layout ]'));
	view.unmount();
});

test('[ and ] cycle the theme through settings', async t => {
	const view = renderScreen(<Screen />);
	await view.press(']');
	await view.waitFor(
		() => view.settings.current().theme === 'green',
		'theme green',
	);
	await view.press('[', '[');
	await view.waitFor(
		() => view.settings.current().theme === 'severance',
		'theme severance',
	);
	t.is(view.settings.current().theme, 'severance');
	view.unmount();
});

test('down scrolls a tall tab', async t => {
	const view = renderScreen(<Screen />, {columns: 36, rows: 10});
	await view.waitFor(() => view.plainFrame().includes('█'), 'scrollbar');
	t.false(view.plainFrame().includes('KeyHints'));
	await view.press('G');
	await view.waitForText('KeyHints');
	t.true(view.plainFrame().includes('KeyHints'));
	view.unmount();
});

test('dialog opens, closes and reports through a toast', async t => {
	const view = renderScreen(<Screen />);
	await view.press(KEYS.left, KEYS.left);
	await view.waitForText('ConfirmDialog');
	await view.press(KEYS.enter, KEYS.enter);
	await view.waitForText('A modal box');
	await view.press(KEYS.enter);
	await view.waitFor(
		() => view.toasts.some(toast => toast.text === 'Dialog closed'),
		'dialog toast',
	);
	t.false(view.plainFrame().includes('A modal box'));
	view.unmount();
});

test('confirm dialog: y confirms, esc cancels', async t => {
	const view = renderScreen(<Screen />);
	await view.press(KEYS.left, KEYS.left, KEYS.enter, 'j', KEYS.enter);
	await view.waitForText('Delete file?');
	await view.press('y');
	await view.waitFor(
		() => view.toasts.some(toast => toast.text.startsWith('Confirmed')),
		'confirm toast',
	);
	await view.press(KEYS.enter);
	await view.waitForText('Delete file?');
	await view.press(KEYS.escape);
	await view.waitFor(
		() => view.toasts.some(toast => toast.text === 'Cancelled'),
		'cancel toast',
	);
	t.true(view.globals.length === 0);
	view.unmount();
});

test('text input edits and commits', async t => {
	const view = renderScreen(<Screen />);
	await view.press('l', 'l', 'l', 'l');
	await view.waitForText('TextInput');
	await view.press(KEYS.enter, 'j', 'j', KEYS.enter);
	await view.press('!', '?');
	await view.waitForText('hello!?');
	await view.press(KEYS.enter, 'j');
	await view.waitFor(
		() => view.plainFrame().includes('❯ Search'),
		'cursor moved on after commit',
	);
	t.true(view.plainFrame().includes('hello!?'));
	view.unmount();
});

test('toggle flips inside the Inputs tab', async t => {
	const view = renderScreen(<Screen />);
	await view.press('l', 'l', 'l', 'l', KEYS.enter);
	await view.waitForText('● on');
	await view.press(KEYS.enter);
	await view.waitForText('○ off');
	t.true(view.plainFrame().includes('○ off'));
	view.unmount();
});

test('every tab fits the body at four sizes', async t => {
	for (const {columns, rows} of SIZES) {
		const view = renderScreen(<Screen />, {columns, rows});
		for (let index = 0; index < TAB_MARKERS.length; index++) {
			// eslint-disable-next-line no-await-in-loop -- Tabs are visited in order.
			await view.waitFor(
				() => view.plainFrame().includes('['),
				`tab ${index} at ${columns}x${rows}`,
			);
			assertFits(t, view, {columns, rows}, `${columns}x${rows} tab ${index}`);

			// eslint-disable-next-line no-await-in-loop -- Tabs are visited in order.
			await view.press('l');
		}

		view.unmount();
	}
});
