import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {PassThrough} from 'node:stream';
import test from 'ava';
import {FILES, README_END, README_START} from '../../scripts/init-plan.js';
import {main} from '../../scripts/init.js';

const ROOT = new URL('../../', import.meta.url);

function makeCheckout(): string {
	const dir = mkdtempSync(join(tmpdir(), 'init-test-'));
	for (const path of Object.values(FILES)) {
		if (!existsSync(new URL(path, ROOT))) {
			continue;
		}

		mkdirSync(dirname(join(dir, path)), {recursive: true});
		cpSync(new URL(path, ROOT), join(dir, path));
	}

	writeFileSync(
		join(dir, FILES.readme),
		`# old\n\n${README_START}\n# old title\n${README_END}\n`,
	);
	return dir;
}

function capture(): {
	io: {input: PassThrough; output: PassThrough};
	text: () => string;
} {
	const output = new PassThrough();
	let collected = '';
	output.on('data', (chunk: Uint8Array) => {
		collected += new TextDecoder().decode(chunk);
	});
	return {io: {input: new PassThrough(), output}, text: () => collected};
}

const flags = (dir: string): string[] => [
	'--yes',
	'--cwd',
	dir,
	'--display-name',
	'Night Owl',
	'--name',
	'night-owl',
	'--command',
	'owl',
	'--tagline',
	'Track your late nights',
	'--description',
	'A terminal app for night owls.',
	'--author',
	'Ada Lovelace',
	'--author-url',
	'https://github.com/ada',
	'--repo',
	'https://github.com/ada/night-owl',
];

const read = (dir: string, path: string): string =>
	readFileSync(join(dir, path), 'utf8');

test('--yes rewrites the identity files, then a second run changes nothing', async t => {
	const dir = makeCheckout();
	try {
		const first = capture();
		t.is(await main(flags(dir), first.io), 0);
		t.regex(first.text(), /Next steps/v);
		t.true(read(dir, FILES.appConfig).includes("command: 'owl',"));
		t.true(read(dir, FILES.packageJson).includes('"owl": "dist/cli.js"'));
		t.true(read(dir, FILES.heading).includes("'NIGHT OWL'"));
		t.true(read(dir, FILES.readme).includes('# Night Owl'));
		t.regex(read(dir, FILES.license), /Ada Lovelace/v);

		const before = Object.values(FILES).map(path => read(dir, path));
		const second = capture();
		t.is(await main(flags(dir), second.io), 0);
		t.regex(second.text(), /Already up to date/v);
		t.deepEqual(
			Object.values(FILES).map(path => read(dir, path)),
			before,
		);
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
});

test('--dry-run prints edits and writes nothing', async t => {
	const dir = makeCheckout();
	try {
		const before = read(dir, FILES.appConfig);
		const out = capture();
		t.is(await main([...flags(dir), '--dry-run'], out.io), 0);
		t.regex(out.text(), /Would write source\/app\.config\.ts/v);
		t.is(read(dir, FILES.appConfig), before);
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
});

test('invalid answers exit 2 and write nothing', async t => {
	const dir = makeCheckout();
	try {
		const before = read(dir, FILES.packageJson);
		const out = capture();
		t.is(await main([...flags(dir), '--name', 'Bad Name'], out.io), 2);
		t.regex(out.text(), /not a valid npm name/v);
		t.is(read(dir, FILES.packageJson), before);
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
});

test('interactive mode: Enter keeps the current values and confirms', async t => {
	const dir = makeCheckout();
	try {
		const out = capture();
		out.io.output.on('data', (chunk: Uint8Array) => {
			const text = new TextDecoder().decode(chunk);
			if (text.endsWith('[Y/n] ')) {
				out.io.input.write('y\n');
			} else if (text.endsWith(']: ')) {
				out.io.input.write('\n');
			}
		});
		t.is(await main(['--cwd', dir, '--display-name', 'Keep Me'], out.io), 0);
		t.true(read(dir, FILES.appConfig).includes("displayName: 'Keep Me',"));
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
});
