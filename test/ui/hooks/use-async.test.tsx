import {setTimeout as delay} from 'node:timers/promises';
import test from 'ava';
import {Text} from 'ink';
import {fail, ok} from '../../../source/core/result.js';
import {useAsync} from '../../../source/ui/hooks/use-async.js';
import type {AsyncControl, AsyncRun} from '../../../source/ui/hooks/types.js';
import {waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

const waitLong = async (isDone: () => boolean, label: string) =>
	waitFor(isDone, label, 20_000);

type Control = AsyncControl<string, string, [string]>;

function AsyncProbe({
	run,
	onControl,
}: {
	run: AsyncRun<string, string, [string]>;
	onControl: (control: Control) => void;
}) {
	const control = useAsync(run);
	onControl(control);
	const {state} = control;
	const label =
		state.status === 'done'
			? `done:${state.value}`
			: state.status === 'failed'
				? `failed:${state.error}`
				: state.status;
	return <Text>state={label}</Text>;
}

function mount(run: AsyncRun<string, string, [string]>) {
	let control: Control | undefined;
	const view = renderThemed(
		<AsyncProbe
			run={run}
			onControl={next => {
				control = next;
			}}
		/>,
	);
	const current = () => {
		if (control === undefined) {
			throw new Error('Probe not rendered');
		}

		return control;
	};

	return {view, control: current};
}

test('start shows loading then done with the value', async t => {
	const {view, control} = mount(async (_signal, label) => {
		await delay(5);
		return ok(`got ${label}`);
	});
	await waitLong(() => view.plainFrame().includes('state=idle'), 'idle');
	control().start('a');
	await waitLong(() => view.plainFrame().includes('state=done:got a'), 'done');
	t.true(view.plainFrame().includes('state=done:got a'));
	view.unmount();
});

test('a failed Result maps to failed with its error', async t => {
	const {view, control} = mount(async () => {
		await delay(1);
		return fail('boom');
	});
	await waitLong(() => view.plainFrame().includes('state=idle'), 'idle');
	control().start('x');
	await waitLong(
		() => view.plainFrame().includes('state=failed:boom'),
		'failed',
	);
	t.true(view.plainFrame().includes('state=failed:boom'));
	view.unmount();
});

test('starting again aborts the previous run and ignores its result', async t => {
	const signals: AbortSignal[] = [];
	const {view, control} = mount(async (signal, label) => {
		signals.push(signal);
		await delay(label === 'first' ? 40 : 5);
		return ok(label);
	});
	await waitLong(() => view.plainFrame().includes('state=idle'), 'idle');
	control().start('first');
	control().start('second');
	await waitLong(
		() => view.plainFrame().includes('state=done:second'),
		'second done',
	);
	await waitLong(() => signals[0]?.aborted === true, 'first aborted');
	await delay(60);
	t.true(view.plainFrame().includes('state=done:second'));
	t.false(signals[1]?.aborted);
	view.unmount();
});

test('cancel returns to idle and ignores the late result', async t => {
	const signals: AbortSignal[] = [];
	const {view, control} = mount(async (signal, label) => {
		signals.push(signal);
		await delay(60);
		return ok(label);
	});
	await waitLong(() => view.plainFrame().includes('state=idle'), 'idle');
	control().start('slow');
	await waitLong(() => signals.length === 1, 'run started');
	control().cancel();
	await waitLong(() => view.plainFrame().includes('state=idle'), 'cancelled');
	t.true(signals[0]?.aborted === true);
	await delay(90);
	t.true(view.plainFrame().includes('state=idle'));
	view.unmount();
});

test('unmount aborts the running operation', async t => {
	const signals: AbortSignal[] = [];
	const {view, control} = mount(async signal => {
		signals.push(signal);
		await delay(30);
		return ok('late');
	});
	await waitLong(() => view.plainFrame().includes('state=idle'), 'idle');
	control().start('x');
	await waitLong(() => signals.length === 1, 'run started');
	view.unmount();
	t.true(signals[0]?.aborted === true);
	await delay(50);
});
