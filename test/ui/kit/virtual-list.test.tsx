import test from 'ava';
import {T, VirtualList} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

const items = Array.from({length: 5000}, (_, i) => `item${i}`);

function list(
	cursor: number,
	extra: {isFocused?: boolean; hasScrollbar?: boolean} = {},
) {
	return (
		<VirtualList
			items={items}
			cursor={cursor}
			height={4}
			getKey={item => item}
			renderItem={item => <T>{item}</T>}
			{...extra}
		/>
	);
}

test('mounts only the window of 5000 items', t => {
	const started = Date.now();
	const r = renderThemed(list(0, {isFocused: true}));
	const frame = r.plainFrame();
	t.true(Date.now() - started < 2000);
	t.true(frame.includes('❯ item0'));
	t.true(frame.includes('item3'));
	t.false(frame.includes('item4'));
	r.unmount();
});

test('window follows the cursor and is stable', t => {
	const r = renderThemed(list(10, {isFocused: true}));
	t.true(r.plainFrame().includes('❯ item10'));
	t.false(r.plainFrame().includes('item6'));
	r.rerender(list(8, {isFocused: true}));
	const frame = r.plainFrame();
	t.true(frame.includes('❯ item8'));
	t.true(frame.includes('item7'));
	t.true(frame.includes('item10'));
	r.unmount();
});

test('end of list shows the last rows', t => {
	const r = renderThemed(list(4999, {isFocused: true}));
	const frame = r.plainFrame();
	t.true(frame.includes('❯ item4999'));
	t.true(frame.includes('item4996'));
	r.unmount();
});

test('unfocused list has no marker', t => {
	const r = renderThemed(list(0));
	t.false(r.plainFrame().includes('❯'));
	r.unmount();
});

test('empty list shows emptyText', t => {
	const r = renderThemed(
		<VirtualList
			items={[]}
			cursor={0}
			height={3}
			emptyText="Nothing here"
			getKey={(item: string) => item}
			renderItem={item => <T>{item}</T>}
		/>,
	);
	t.true(r.plainFrame().includes('Nothing here'));
	r.unmount();
});

test('scrollbar is drawn when requested', t => {
	const r = renderThemed(list(0, {hasScrollbar: true}));
	t.true(r.plainFrame().includes('█'));
	r.unmount();
});
