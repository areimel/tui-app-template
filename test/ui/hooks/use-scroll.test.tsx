import test, {type ExecutionContext} from 'ava';
import {Text} from 'ink';
import {useScroll} from '../../../source/ui/hooks/use-scroll.js';
import type {ScrollOptions} from '../../../source/ui/hooks/types.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS, pressKeys, waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

const waitLong = async (isDone: () => boolean, label: string) =>
	waitFor(isDone, label, 20_000);

function ScrollProbe({options}: {options: ScrollOptions}) {
	const {offset, isAtEnd} = useScroll(options);
	return (
		<Text>
			at [{offset}] {isAtEnd ? 'end' : 'more'}
		</Text>
	);
}

function render(options: ScrollOptions) {
	const ready = createReadySignal();
	const node = (next: ScrollOptions) => (
		<>
			<ready.ReadySignal />
			<ScrollProbe options={next} />
		</>
	);
	const view = renderThemed(node(options));
	return {
		view,
		ready,
		update(next: ScrollOptions) {
			view.rerender(node(next));
		},
	};
}

const expectAt = async (
	t: ExecutionContext,
	view: ReturnType<typeof renderThemed>,
	offset: number,
) => {
	await waitLong(
		() => view.plainFrame().includes(`at [${offset}]`),
		`offset ${offset}`,
	);
	t.true(view.plainFrame().includes(`at [${offset}]`));
};

test('arrows and j/k move one row and clamp to the last full viewport', async t => {
	const {view, ready} = render({contentRows: 10, viewportRows: 4});
	await ready.whenReady();
	await expectAt(t, view, 0);
	await pressKeys(view.stdin, KEYS.up, 'k');
	await expectAt(t, view, 0);
	await pressKeys(view.stdin, KEYS.down, 'j');
	await expectAt(t, view, 2);
	await pressKeys(view.stdin, ...Array.from({length: 10}, () => KEYS.down));
	await expectAt(t, view, 6);
	view.unmount();
});

test('isAtEnd reports when the last row is in view', async t => {
	const {view, ready} = render({contentRows: 5, viewportRows: 5});
	await ready.whenReady();
	await waitLong(() => view.plainFrame().includes('end'), 'at end');
	t.true(view.plainFrame().includes('end'));
	view.unmount();
});

test('PageUp and PageDown move by viewport minus one', async t => {
	const {view, ready} = render({contentRows: 20, viewportRows: 4});
	await ready.whenReady();
	await pressKeys(view.stdin, KEYS.pageDown);
	await expectAt(t, view, 3);
	await pressKeys(
		view.stdin,
		KEYS.pageDown,
		KEYS.pageDown,
		KEYS.pageDown,
		KEYS.pageDown,
		KEYS.pageDown,
		KEYS.pageDown,
	);
	await expectAt(t, view, 16);
	await pressKeys(view.stdin, KEYS.pageUp);
	await expectAt(t, view, 13);
	view.unmount();
});

test('Home/End and g/G jump to the top and bottom', async t => {
	const {view, ready} = render({contentRows: 12, viewportRows: 4});
	await ready.whenReady();
	await pressKeys(view.stdin, 'G');
	await expectAt(t, view, 8);
	await pressKeys(view.stdin, KEYS.home);
	await expectAt(t, view, 0);
	await pressKeys(view.stdin, KEYS.end);
	await expectAt(t, view, 8);
	await pressKeys(view.stdin, 'g');
	await expectAt(t, view, 0);
	view.unmount();
});

test('shrinking content clamps the offset', async t => {
	const {view, ready, update} = render({contentRows: 20, viewportRows: 5});
	await ready.whenReady();
	await pressKeys(view.stdin, KEYS.end);
	await expectAt(t, view, 15);
	update({contentRows: 8, viewportRows: 5});
	await expectAt(t, view, 3);
	view.unmount();
});

test('isFollowing sticks to the end as content grows, until the user scrolls up', async t => {
	const {view, ready, update} = render({
		contentRows: 5,
		viewportRows: 3,
		isFollowing: true,
	});
	await ready.whenReady();
	await expectAt(t, view, 2);
	update({contentRows: 8, viewportRows: 3, isFollowing: true});
	await expectAt(t, view, 5);
	await pressKeys(view.stdin, KEYS.up);
	await expectAt(t, view, 4);
	update({contentRows: 10, viewportRows: 3, isFollowing: true});
	await expectAt(t, view, 4);
	view.unmount();
});

test('isActive false registers no keys', async t => {
	const ready = createReadySignal();
	const view = renderThemed(
		<>
			<ready.ReadySignal />
			<ScrollProbe
				options={{contentRows: 10, viewportRows: 4, isActive: false}}
			/>
		</>,
	);
	await ready.whenReady();
	await pressKeys(view.stdin, KEYS.down, KEYS.down);
	await expectAt(t, view, 0);
	view.unmount();
});
