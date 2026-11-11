import test from 'ava';
import {Box} from 'ink';
import {ConfirmDialog} from '../../../source/ui/kit/index.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS, pressKeys, waitFor} from '../../helpers/keys.js';
import {renderSized} from '../../helpers/render-sized.js';

async function setup(isDanger = false) {
	const calls: string[] = [];
	const signal = createReadySignal();
	const r = renderSized(
		<Box width={60} height={14}>
			<signal.ReadySignal />
			<ConfirmDialog
				title="Delete"
				message="Really delete?"
				confirmLabel="Delete"
				isDanger={isDanger}
				onConfirm={() => {
					calls.push('confirm');
				}}
				onCancel={() => {
					calls.push('cancel');
				}}
			/>
		</Box>,
		60,
		14,
	);
	await signal.whenReady();
	return {r, calls};
}

test('cancel is focused by default; Enter cancels', async t => {
	const {r, calls} = await setup();
	t.regex(r.plainFrame(), /❯ Cancel/v);
	t.regex(r.plainFrame(), /Really delete\?/v);
	await pressKeys(r.stdin, KEYS.enter);
	await waitFor(() => calls.length > 0, 'cancel');
	t.deepEqual(calls, ['cancel']);
	r.unmount();
});

test('right then Enter confirms; tab toggles', async t => {
	const {r, calls} = await setup();
	await pressKeys(r.stdin, KEYS.right);
	await waitFor(() => r.plainFrame().includes('❯ Delete'), 'confirm focus');
	await pressKeys(r.stdin, KEYS.tab);
	await waitFor(() => r.plainFrame().includes('❯ Cancel'), 'cancel focus');
	await pressKeys(r.stdin, KEYS.left, KEYS.enter);
	await waitFor(() => calls.length > 0, 'confirm');
	t.deepEqual(calls, ['confirm']);
	r.unmount();
});

test('y confirms, n cancels, Esc cancels', async t => {
	const a = await setup();
	await pressKeys(a.r.stdin, 'y');
	await waitFor(() => a.calls.length > 0, 'y');
	t.deepEqual(a.calls, ['confirm']);
	a.r.unmount();

	const b = await setup();
	await pressKeys(b.r.stdin, 'n');
	await waitFor(() => b.calls.length > 0, 'n');
	t.deepEqual(b.calls, ['cancel']);
	b.r.unmount();

	const c = await setup();
	await pressKeys(c.r.stdin, KEYS.escape);
	await waitFor(() => c.calls.length > 0, 'esc');
	t.deepEqual(c.calls, ['cancel']);
	c.r.unmount();
});

test('isDanger adds a warning glyph and says it cannot be undone', async t => {
	const {r} = await setup(true);
	t.regex(r.plainFrame(), /⚠ Delete/v);
	t.regex(r.plainFrame(), /cannot be undone/v);
	r.unmount();
	const plain = await setup(false);
	t.notRegex(plain.r.plainFrame(), /⚠/v);
	plain.r.unmount();
});
