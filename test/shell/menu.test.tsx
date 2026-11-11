import test from 'ava';
import {
	HEADING_HEIGHT,
	HEADING_WIDTH,
} from '../../source/shell/brand/heading-art.js';
import {planMenu} from '../../source/shell/menu-plan.js';
import {shortcutBindings} from '../../source/shell/Menu.js';
import {T} from '../../source/ui/kit/T.js';
import {KEYS} from '../helpers/keys.js';
import {createTestApp, mountShell, type Mounted} from './shell-harness.js';

const ART = {width: HEADING_WIDTH, height: HEADING_HEIGHT};

async function withMenu(
	options: Parameters<typeof mountShell>[0],
	run: (shell: Mounted) => Promise<void>,
) {
	const shell = mountShell(options);
	try {
		await run(shell);
	} finally {
		shell.unmount();
	}
}

const manyApps = () =>
	Array.from({length: 14}, (_, index) =>
		createTestApp(
			`app-${index + 1}`,
			`App ${String(index + 1).padStart(2, '0')}`,
		),
	);

test('planMenu keeps the art while the list still gets its rows', t => {
	t.deepEqual(planMenu({columns: 100, rows: 30}, 7, ART), {
		brand: 'art',
		listHeight: 7,
		hasScrollbar: false,
	});
});

test('planMenu falls back to the compact heading when the art would squeeze the list', t => {
	const plan = planMenu({columns: 100, rows: 12}, 7, ART);
	t.is(plan.brand, 'compact');
	t.is(plan.listHeight, 7);
});

test('planMenu uses the compact heading below the art width', t => {
	t.is(planMenu({columns: ART.width - 1, rows: 40}, 3, ART).brand, 'compact');
});

test('planMenu drops the heading on a very short body and windows the list', t => {
	const plan = planMenu({columns: 60, rows: 4}, 7, ART);
	t.is(plan.brand, 'none');
	t.is(plan.listHeight, 4);
	t.true(plan.hasScrollbar);
});

test('planMenu never gives the list more rows than apps or body', t => {
	t.is(planMenu({columns: 60, rows: 0}, 3, ART).listHeight, 0);
	t.is(planMenu({columns: 60, rows: 50}, 2, ART).listHeight, 2);
});

test('shortcutBindings binds 1-9 to the first nine apps, named after them', t => {
	const bindings = shortcutBindings(manyApps());
	t.is(bindings.length, 9);
	t.deepEqual(bindings[0]?.keys, ['1']);
	t.is(bindings[8]?.label, 'open App 09');
	t.is(bindings[0]?.action, 'app-1');
});

test('the menu lists every app with number, glyph, title and description', async t => {
	await withMenu({columns: 100, rows: 30}, async shell => {
		await shell.waitForText('Bare One');
		const text = shell.lines().join('\n');
		t.regex(text, /❯ 1 ◆ Alpha {5}Alpha description/v);
		t.regex(text, /2 ◆ Beta/v);
		t.regex(text, /3 ◆ Bare One {2}Bare One description/v);
	});
});

test('down moves the cursor marker and Enter opens that app', async t => {
	await withMenu({columns: 100, rows: 30}, async shell => {
		await shell.waitForText('Alpha');
		await shell.press(KEYS.down);
		await shell.waitForText('❯ 2 ◆ Beta');
		t.false(shell.lines().join('\n').includes('❯ 1'));
		await shell.press(KEYS.enter);
		await shell.waitForText('Beta screen');
		t.deepEqual(shell.router.calls, [{type: 'push', route: {id: 'beta'}}]);
		t.is(shell.current().id, 'beta');
	});
});

test('number keys open the matching app', async t => {
	await withMenu({columns: 100, rows: 30}, async shell => {
		await shell.waitForText('Alpha');
		await shell.press('2');
		await shell.waitForText('Beta screen');
		t.is(shell.current().id, 'beta');
	});
});

test('Esc on a page returns to the menu', async t => {
	await withMenu({columns: 100, rows: 30}, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		await shell.press(KEYS.escape);
		await shell.waitForText('Alpha description');
		t.is(shell.current().id, 'menu');
	});
});

test('a long list is windowed to the body and still reaches its last app', async t => {
	await withMenu({columns: 60, rows: 14, apps: manyApps()}, async shell => {
		await shell.waitForText('App 01');
		t.false(shell.lines().join('\n').includes('App 14'));
		await shell.press('G');
		await shell.waitForText('❯   ◆ App 14');
		t.false(shell.lines().join('\n').includes('App 01'));
		await shell.press(KEYS.enter);
		await shell.waitForText('App 14 screen');
		t.is(shell.current().id, 'app-14');
	});
});

test('apps for another platform are shown disabled and refuse to open', async t => {
	const apps = [
		createTestApp('here', 'Here', {platforms: ['linux']}),
		createTestApp('there', 'There', {platforms: ['darwin']}),
	];
	await withMenu(
		{columns: 100, rows: 30, apps, platform: 'linux'},
		async shell => {
			await shell.waitForText('Not available on linux');
			await shell.press('2');
			await shell.waitForText('There is not available on linux');
			t.is(shell.current().id, 'menu');
			t.is(shell.toasts[0]?.tone, 'warn');
		},
	);
});

test('an app menu badge is drawn after its row', async t => {
	const apps = [
		createTestApp('badged', 'Badged', {
			menuBadge: () => <T bold>[awake]</T>,
		}),
	];
	await withMenu({columns: 100, rows: 30, apps}, async shell => {
		await shell.waitForText('[awake]');
		t.regex(shell.lines().join('\n'), /Badged description\s+\[awake\]/v);
	});
});

test('an empty app list says so instead of crashing', async t => {
	await withMenu({columns: 80, rows: 24, apps: []}, async shell => {
		await shell.waitForText('No apps installed');
		t.deepEqual(shell.router.calls, []);
	});
});
