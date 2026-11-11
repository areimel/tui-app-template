import test from 'ava';
import {ScrollView, T} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

const rows = Array.from({length: 10}, (_, i) => `row${i}`);
const content = rows.map(r => <T key={r}>{r}</T>);

test('shows only the rows from the offset', t => {
	const r = renderThemed(
		<ScrollView height={3} offset={4}>
			{content}
		</ScrollView>,
	);
	const frame = r.plainFrame();
	t.true(frame.includes('row4') && frame.includes('row6'));
	t.false(frame.includes('row3') || frame.includes('row7'));
	r.unmount();
});

test('scrollbar thumb at top and bottom', t => {
	const top = renderThemed(
		<ScrollView hasScrollbar height={4} offset={0} contentRows={10}>
			{content}
		</ScrollView>,
	);
	const topLines = top.plainFrame().split('\n');
	t.true((topLines[0] ?? '').endsWith('█'));
	t.true((topLines[3] ?? '').endsWith('│'));
	top.unmount();

	const bottom = renderThemed(
		<ScrollView hasScrollbar height={4} offset={6} contentRows={10}>
			{content}
		</ScrollView>,
	);
	const bottomLines = bottom.plainFrame().split('\n');
	t.true((bottomLines[0] ?? '').endsWith('│'));
	t.true((bottomLines[3] ?? '').endsWith('█'));
	bottom.unmount();
});

test('no scrollbar when content fits', t => {
	const r = renderThemed(
		<ScrollView hasScrollbar height={12} offset={0} contentRows={10}>
			{content}
		</ScrollView>,
	);
	t.false(r.plainFrame().includes('█'));
	r.unmount();
});
