import {setTimeout as delay} from 'node:timers/promises';
import test from 'ava';
import {Text} from 'ink';
import {usePoll} from '../../../source/ui/hooks/use-poll.js';
import {waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

const waitLong = async (isDone: () => boolean, label: string) =>
	waitFor(isDone, label, 20_000);

function PollProbe({
	read,
	intervalMs,
	isActive,
}: {
	read: () => string;
	intervalMs?: number;
	isActive?: boolean;
}) {
	const value = usePoll(read, {
		intervalMs: intervalMs ?? 5,
		isActive: isActive ?? true,
	});
	return <Text>value={value}</Text>;
}

function counter() {
	let calls = 0;
	return {
		get calls() {
			return calls;
		},
		read() {
			calls += 1;
			return `n${calls}`;
		},
	};
}

test('reads immediately and then on each interval', async t => {
	const source = counter();
	const view = renderThemed(<PollProbe read={source.read} />);
	await waitLong(() => view.plainFrame().includes('value=n1'), 'first read');
	await waitLong(() => source.calls >= 3, 'interval reads');
	await waitLong(() => view.plainFrame().includes('value=n3'), 'latest value');
	t.true(view.plainFrame().includes('value=n3'));
	view.unmount();
});

test('always calls the latest read function', async t => {
	const view = renderThemed(<PollProbe read={() => 'old'} />);
	await waitLong(() => view.plainFrame().includes('value=old'), 'old reader');
	view.rerender(<PollProbe read={() => 'new'} />);
	await waitLong(() => view.plainFrame().includes('value=new'), 'new reader');
	t.true(view.plainFrame().includes('value=new'));
	view.unmount();
});

test('isActive false stops the timer and keeps the last value', async t => {
	const source = counter();
	const view = renderThemed(<PollProbe read={source.read} />);
	await waitLong(() => source.calls >= 2, 'polling');
	view.rerender(<PollProbe read={source.read} isActive={false} />);
	await delay(10);
	const frozen = source.calls;
	const shown = view.plainFrame();
	await delay(60);
	t.is(source.calls, frozen);
	t.is(view.plainFrame(), shown);
	view.unmount();
});

test('unmount clears the timer', async t => {
	const source = counter();
	const view = renderThemed(<PollProbe read={source.read} />);
	await waitLong(() => source.calls >= 2, 'polling');
	view.unmount();
	const frozen = source.calls;
	await delay(60);
	t.is(source.calls, frozen);
});
