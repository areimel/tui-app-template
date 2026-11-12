import test from 'ava';
import {TOAST_MS} from '../../source/shell/use-toast-state.js';
import {KEYS, waitFor} from '../helpers/keys.js';
import {withShell} from './shell-fixture.js';

test.serial('menu: Enter and number keys open apps, Esc goes back', async t => {
	await withShell(async shell => {
		await shell.waitForText('Draws its own chrome');
		t.false(shell.lastLine().includes('back'), 'no back hint at the menu');
		await shell.press(KEYS.enter);
		await shell.waitForText('Counter screen, service #1');
		t.regex(shell.lastLine(), /back/v);
		await shell.press(KEYS.escape);
		await shell.waitForText('Has a service');
		await shell.press('2');
		await shell.waitForText('Plain screen pokes=0');
		await shell.press(KEYS.backspace, '3');
		await shell.waitForText('Bare screen');
		t.false(shell.text().includes('┏'), 'bare apps get no frame');
	});
});

test.serial(
	'help overlay lists screen and global keys and blocks screen keys',
	async t => {
		await withShell(async shell => {
			await shell.press('2');
			await shell.waitForText('Plain screen pokes=0');
			await shell.press('?');
			await shell.waitForText('Help: Plain');
			const help = shell.text();
			t.regex(help, /poke it/v);
			t.regex(help, /quit/v);
			t.regex(help, /themes/v);
			await shell.press('x');
			await shell.press(KEYS.escape);
			await shell.waitForGone('Help: Plain');
			t.is(shell.pokes(), 0, 'x went to the help dialog, not the screen');
			await shell.press('x');
			await shell.waitForText('Plain screen pokes=1');
		});
	},
);

test.serial(
	'theme picker previews, then commits the choice to the tracker',
	async t => {
		await withShell(async shell => {
			await shell.waitForText('Counter');
			await shell.press('t');
			await shell.waitForText('Classic green screen');
			await shell.press(KEYS.down);
			await shell.waitForText(/❯ Green/v);
			t.is(shell.tracker.effective().theme, 'amber', 'a preview is not saved');
			t.is(shell.saved.length, 0);
			await shell.press(KEYS.enter);
			await shell.waitForGone('Classic green screen');
			t.is(shell.tracker.effective().theme, 'green');
			t.true(shell.tracker.dirtyPaths().has('theme'));
			t.is(shell.saved.at(-1)?.theme, 'green');
			await shell.press('T');
			await waitFor(() => shell.saved.length === 2, 'cycled', 15_000);
			t.is(shell.tracker.effective().theme, 'severance');
		});
	},
);

test.serial('a toast shows in the footer and expires on the clock', async t => {
	await withShell(async shell => {
		await shell.press('1');
		await shell.waitForText('Counter screen');
		await shell.press('x');
		await shell.waitForText('poked!');
		t.regex(shell.lastLine(), /poked!/v);
		shell.clock.tick(TOAST_MS - 1);
		await shell.press('?', KEYS.escape);
		t.true(shell.text().includes('poked!'), 'still shown just before expiry');
		shell.clock.tick(1);
		await shell.waitForGone('poked!');
	});
});

test.serial(
	'a service is created once, kept across visits, and stopped on quit',
	async t => {
		await withShell(async shell => {
			await shell.press('1');
			await shell.waitForText('Counter screen, service #1');
			await shell.press(KEYS.escape);
			await shell.waitForText('Has a service');
			t.truthy(shell.appServices.get('counter'), 'kept alive at the menu');
			await shell.press('1');
			await shell.waitForText('Counter screen, service #1');
			t.is(shell.creations(), 1);
			await shell.press('q');
			await waitFor(() => shell.exits.length > 0, 'exit', 15_000);
			t.deepEqual(shell.exits, [0]);
			t.deepEqual(shell.calls, [
				'create',
				'stop:user',
				'releaseSync',
				'flush',
				'data.flushAll',
			]);
		});
	},
);

test.serial('Ctrl+C quits once', async t => {
	await withShell(async shell => {
		await shell.waitForText('Counter');
		await shell.press(KEYS.ctrlC, KEYS.ctrlC);
		await waitFor(() => shell.exits.length > 0, 'exit', 15_000);
		await shell.press('q');
		t.deepEqual(shell.exits, [0]);
		t.deepEqual(shell.calls, ['flush', 'data.flushAll']);
	});
});

test.serial(
	'a deep link opens the app over the menu and starts its service',
	async t => {
		await withShell(
			async shell => {
				await shell.waitForText('Counter screen, service #1');
				t.is(shell.creations(), 1);
				await shell.press(KEYS.escape);
				await shell.waitForText('Draws its own chrome');
			},
			{initialRoute: {id: 'counter'}},
		);
	},
);

test.serial('a route that names no app shows a not-found page', async t => {
	await withShell(
		async shell => {
			await shell.waitForText('No app named "ghost".');
			await shell.press(KEYS.escape);
			await shell.waitForText('Has a service');
			t.false(shell.text().includes('ghost'));
		},
		{initialRoute: {id: 'ghost'}},
	);
});
