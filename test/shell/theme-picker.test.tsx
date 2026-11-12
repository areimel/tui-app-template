import test from 'ava';
import {THEMES} from '../../source/theme/palettes.js';
import {THEME_NAMES} from '../../source/theme/tokens.js';
import {THEME_DESCRIPTIONS} from '../../source/shell/overlays/ThemePicker.js';
import {KEYS} from '../helpers/keys.js';
import {mountShell, type Mounted} from './shell-harness.js';

async function withPicker(run: (shell: Mounted) => Promise<void>) {
	const shell = mountShell({columns: 80, rows: 24});
	try {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		await shell.press('t');
		await shell.waitForText('Theme');
		await run(shell);
	} finally {
		shell.unmount();
	}
}

const state = (shell: Mounted) => {
	const {theme, shownTheme} = shell.settings.settings();
	return {theme, shownTheme};
};

test('every theme has a description', t => {
	for (const name of THEME_NAMES) {
		t.true(THEME_DESCRIPTIONS[name].length > 0, name);
	}
});

test('the picker lists every theme with its description and marks the current one', async t => {
	await withPicker(async shell => {
		const text = shell.lines().join('\n');
		for (const name of THEME_NAMES) {
			t.true(text.includes(THEMES[name].label), name);
			t.true(text.includes(THEME_DESCRIPTIONS[name]), name);
		}

		t.regex(text, /❯ Amber/v);
		t.regex(text, /\(current\)/v);
	});
});

test('moving the cursor previews the theme without committing it', async t => {
	await withPicker(async shell => {
		await shell.press(KEYS.down);
		await shell.waitForText('❯ Green');
		t.deepEqual(state(shell), {theme: 'amber', shownTheme: 'green'});
		await shell.press(KEYS.down);
		await shell.waitForText('❯ Severance');
		t.deepEqual(state(shell), {theme: 'amber', shownTheme: 'severance'});
	});
});

test('Enter commits the previewed theme and closes the picker', async t => {
	await withPicker(async shell => {
		await shell.press(KEYS.down, KEYS.enter);
		await shell.waitForGone('Classic green screen');
		t.deepEqual(state(shell), {theme: 'green', shownTheme: 'green'});
	});
});

test('Esc cancels: the preview ends and the theme is unchanged', async t => {
	await withPicker(async shell => {
		await shell.press(KEYS.down);
		await shell.waitForText('❯ Green');
		await shell.press(KEYS.escape);
		await shell.waitForGone('Classic green screen');
		t.deepEqual(state(shell), {theme: 'amber', shownTheme: 'amber'});
	});
});

test('while the picker is open the screen and global keys are blocked', async t => {
	await withPicker(async shell => {
		await shell.press('x', 'q', '?');
		t.deepEqual(shell.globals, []);
		t.false(shell.lines().join('\n').includes('Help'));
		await shell.press(KEYS.escape);
		await shell.waitForGone('Classic green screen');
		t.regex(shell.lines().join('\n'), /marks=0/v);
	});
});
