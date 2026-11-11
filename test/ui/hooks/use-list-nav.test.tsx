import test, {type ExecutionContext} from 'ava';
import {Text} from 'ink';
import {
	LIST_NAV_BINDINGS,
	useListNav,
} from '../../../source/ui/hooks/use-list-nav.js';
import type {ListNavOptions} from '../../../source/ui/hooks/types.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS, pressKeys, waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

const waitLong = async (isDone: () => boolean, label: string) =>
	waitFor(isDone, label, 20_000);

function ListProbe({options}: {options: ListNavOptions}) {
	const {cursor} = useListNav(options);
	return <Text>at [{cursor}]</Text>;
}

function mount(options: ListNavOptions) {
	const ready = createReadySignal();
	const view = renderThemed(
		<>
			<ready.ReadySignal />
			<ListProbe options={options} />
		</>,
	);
	return {view, ready};
}

const expectAt = async (
	t: ExecutionContext,
	view: ReturnType<typeof renderThemed>,
	index: number,
) => {
	await waitLong(
		() => view.plainFrame().includes(`at [${index}]`),
		`cursor ${index}`,
	);
	t.true(view.plainFrame().includes(`at [${index}]`));
};

test('arrows and j/k move one row and clamp at both ends', async t => {
	const {view, ready} = mount({count: 3});
	await ready.whenReady();
	await expectAt(t, view, 0);
	await pressKeys(view.stdin, KEYS.down, KEYS.down, KEYS.down, KEYS.down);
	await expectAt(t, view, 2);
	await pressKeys(view.stdin, KEYS.up, KEYS.up, KEYS.up, KEYS.up, KEYS.up);
	await expectAt(t, view, 0);
	await pressKeys(view.stdin, 'j', 'j');
	await expectAt(t, view, 2);
	await pressKeys(view.stdin, 'k');
	await expectAt(t, view, 1);
	view.unmount();
});

test('isWrapping wraps past either end', async t => {
	const {view, ready} = mount({count: 3, isWrapping: true});
	await ready.whenReady();
	await pressKeys(view.stdin, KEYS.up);
	await expectAt(t, view, 2);
	await pressKeys(view.stdin, KEYS.down);
	await expectAt(t, view, 0);
	view.unmount();
});

test('PageUp and PageDown move by pageSize and clamp', async t => {
	const {view, ready} = mount({count: 10, pageSize: 2});
	await ready.whenReady();
	await pressKeys(view.stdin, KEYS.pageDown);
	await expectAt(t, view, 2);
	await pressKeys(
		view.stdin,
		KEYS.pageDown,
		KEYS.pageDown,
		KEYS.pageDown,
		KEYS.pageDown,
		KEYS.pageDown,
	);
	await expectAt(t, view, 9);
	await pressKeys(view.stdin, KEYS.pageUp);
	await expectAt(t, view, 7);
	view.unmount();
});

test('Home/End and g/G jump to the ends', async t => {
	const {view, ready} = mount({count: 5, initialCursor: 2});
	await ready.whenReady();
	await expectAt(t, view, 2);
	await pressKeys(view.stdin, 'G');
	await expectAt(t, view, 4);
	await pressKeys(view.stdin, KEYS.home);
	await expectAt(t, view, 0);
	await pressKeys(view.stdin, KEYS.end);
	await expectAt(t, view, 4);
	await pressKeys(view.stdin, 'g');
	await expectAt(t, view, 0);
	view.unmount();
});

test('Enter reports the cursor row to onSelect', async t => {
	const selected: number[] = [];
	const {view, ready} = mount({
		count: 4,
		onSelect(index) {
			selected.push(index);
		},
	});
	await ready.whenReady();
	await pressKeys(view.stdin, KEYS.down, KEYS.enter);
	await waitLong(() => selected.length === 1, 'select');
	t.deepEqual(selected, [1]);
	view.unmount();
});

test('initialCursor starts there, clamped to the count', async t => {
	const {view, ready} = mount({count: 3, initialCursor: 9});
	await ready.whenReady();
	await expectAt(t, view, 2);
	view.unmount();
});

test('a shrinking count re-clamps the cursor and does not restore it', async t => {
	const ready = createReadySignal();
	const view = renderThemed(
		<>
			<ready.ReadySignal />
			<ListProbe options={{count: 5, initialCursor: 4}} />
		</>,
	);
	await ready.whenReady();
	await expectAt(t, view, 4);
	view.rerender(
		<>
			<ready.ReadySignal />
			<ListProbe options={{count: 2, initialCursor: 4}} />
		</>,
	);
	await expectAt(t, view, 1);
	view.rerender(
		<>
			<ready.ReadySignal />
			<ListProbe options={{count: 5, initialCursor: 4}} />
		</>,
	);
	await expectAt(t, view, 1);
	view.unmount();
});

test('isActive false registers no keys', async t => {
	const ready = createReadySignal();
	const view = renderThemed(
		<>
			<ready.ReadySignal />
			<ListProbe options={{count: 5, isActive: false}} />
		</>,
	);
	await ready.whenReady();
	await pressKeys(view.stdin, KEYS.down, KEYS.down);
	await expectAt(t, view, 0);
	view.rerender(
		<>
			<ready.ReadySignal />
			<ListProbe options={{count: 5, isActive: true}} />
		</>,
	);
	await pressKeys(view.stdin, KEYS.down);
	await expectAt(t, view, 1);
	view.unmount();
});

test('LIST_NAV_BINDINGS hint up and down as "↑↓ move"', t => {
	const up = LIST_NAV_BINDINGS.find(binding => binding.action === 'up');
	t.is(up?.caption, '↑↓');
	t.is(up?.label, 'move');
	t.is(
		LIST_NAV_BINDINGS.find(binding => binding.action === 'down')?.label,
		'move',
	);
});
