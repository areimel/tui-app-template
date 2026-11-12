import test from 'ava';
import {Box} from 'ink';
import {Dialog, T} from '../../../source/ui/kit/index.js';
import {useKeys} from '../../../source/ui/input/index.js';
import {PLAIN_THEME, ThemeProvider} from '../../../source/theme/context.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {pressKeys, waitFor} from '../../helpers/keys.js';
import {renderSized} from '../../helpers/render-sized.js';

function fill(columns: number, rows: number): string {
	return Array.from({length: rows}, () => 'z'.repeat(columns)).join('\n');
}

function Host({
	columns,
	rows,
	isOpen = true,
	width = 20,
	height,
}: {
	readonly columns: number;
	readonly rows: number;
	readonly isOpen?: boolean;
	readonly width?: number;
	readonly height?: number;
}) {
	return (
		<ThemeProvider theme={PLAIN_THEME}>
			<Box width={columns} height={rows}>
				<T>{fill(columns, rows)}</T>
				{isOpen ? (
					<Dialog
						title="Hello"
						width={width}
						{...(height === undefined ? {} : {height})}
						hints={[{keys: 'esc', label: 'close'}]}
					>
						<T>body text</T>
					</Dialog>
				) : undefined}
			</Box>
		</ThemeProvider>
	);
}

test('Dialog is opaque on a theme without bg and leaves the rest alone', async t => {
	const r = renderSized(<Host columns={50} rows={14} height={6} />, 50, 14);
	await waitFor(() => r.plainFrame().includes('Hello'), 'dialog');
	const lines = r.plainFrame().split('\n');
	const top = lines.findIndex(line => line.includes('Hello'));
	t.true(top > 0);
	const left = (lines[top] ?? '').indexOf('╭');
	for (let y = top; y < top + 6; y++) {
		const slice = (lines[y] ?? '').slice(left, left + 20);
		t.false(slice.includes('z'), `row ${y}: ${slice}`);
		t.is(slice.length, 20);
	}

	t.is(lines[top - 1], 'z'.repeat(50));
	t.true((lines[top] ?? '').startsWith('z'.repeat(left)));
	t.true((lines[top] ?? '').endsWith('z'.repeat(50 - left - 20)));
	t.regex(lines[top + 5] ?? '', /╰─ esc close ─+╯/v);
	r.unmount();
});

test('Dialog without a height fits its children', async t => {
	const r = renderSized(<Host columns={50} rows={14} />, 50, 14);
	await waitFor(() => r.plainFrame().includes('Hello'), 'dialog');
	const lines = r.plainFrame().split('\n');
	const top = lines.findIndex(line => line.includes('Hello'));
	t.regex(lines[top + 1] ?? '', /│ body text\s+│/v);
	t.regex(lines[top + 2] ?? '', /╰/v);
	t.is(lines[top + 3], 'z'.repeat(50));
	r.unmount();
});

test('Dialog is centred at several sizes', async t => {
	for (const [columns, rows, height] of [
		[40, 10, 4],
		[61, 15, 5],
		[80, 24, 8],
	] as const) {
		const r = renderSized(
			<Host columns={columns} rows={rows} height={height} />,
			columns,
			rows,
		);
		// eslint-disable-next-line no-await-in-loop -- Sequential renders.
		await waitFor(() => r.plainFrame().includes('Hello'), 'dialog');
		const lines = r.plainFrame().split('\n');
		const top = lines.findIndex(line => line.includes('Hello'));
		const left = (lines[top] ?? '').indexOf('╭');
		const idealTop = (rows - height) / 2;
		t.true(Math.abs(top - idealTop) <= 0.5);
		const idealLeft = (columns - 20) / 2;
		t.true(Math.abs(left - idealLeft) <= 0.5);
		r.unmount();
	}
});

test('screen bindings are blocked while the dialog is open and work after', async t => {
	let fired = 0;
	const signal = createReadySignal();
	function Screen({isOpen}: {readonly isOpen: boolean}) {
		useKeys([{action: 'go', keys: ['g'], label: 'go'}], {
			go() {
				fired++;
			},
		});
		return (
			<Box width={40} height={10}>
				<signal.ReadySignal />
				<T>screen</T>
				{isOpen ? (
					<Dialog title="Modal" width={20}>
						<T>x</T>
					</Dialog>
				) : undefined}
			</Box>
		);
	}

	const r = renderSized(<Screen isOpen />, 40, 10);
	await signal.whenReady();
	await pressKeys(r.stdin, 'g');
	t.is(fired, 0);
	r.unmount();

	const r2 = renderSized(<Screen isOpen={false} />, 40, 10);
	await pressKeys(r2.stdin, 'g');
	await waitFor(() => fired === 1, 'screen binding');
	t.is(fired, 1);
	r2.unmount();
});

test('Dialog onCancel fires on Esc from inside the modal scope; a parent binding does not', async t => {
	const log: string[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	function Parent() {
		// The mistake the doc warns about: this registers in the screen scope.
		useKeys([{action: 'cancel', keys: ['esc'], label: 'cancel'}], {
			cancel() {
				log.push('parent');
			},
		});
		return (
			<ThemeProvider theme={PLAIN_THEME}>
				<Box width={40} height={10}>
					<ReadySignal />
					<Dialog
						title="Esc"
						width={20}
						onCancel={() => {
							log.push('dialog');
						}}
					>
						<T>body</T>
					</Dialog>
				</Box>
			</ThemeProvider>
		);
	}

	const r = renderSized(<Parent />, 40, 10);
	await whenReady();
	await pressKeys(r.stdin, '\u{1B}');
	await waitFor(() => log.length > 0, 'esc handled');
	t.deepEqual(log, ['dialog']);
	r.unmount();
});
