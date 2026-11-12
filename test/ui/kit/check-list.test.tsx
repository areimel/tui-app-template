import test from 'ava';
import {CheckList} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

const items = Array.from({length: 50}, (_, i) => ({
	value: `v${i}`,
	label: `Label ${i}`,
}));

test('shows checked state and cursor marker', t => {
	const r = renderThemed(
		<CheckList
			isFocused
			items={items}
			checked={new Set(['v1'])}
			cursor={0}
			height={3}
		/>,
	);
	const frame = r.plainFrame();
	t.true(frame.includes('❯ [ ] Label 0'));
	t.true(frame.includes('  [x] Label 1'));
	t.false(frame.includes('Label 3'));
	r.unmount();
});

test('windows to keep the cursor visible', t => {
	const r = renderThemed(
		<CheckList
			isFocused
			items={items}
			checked={new Set<string>()}
			cursor={49}
			height={3}
		/>,
	);
	const frame = r.plainFrame();
	t.true(frame.includes('❯ [ ] Label 49'));
	t.true(frame.includes('Label 47'));
	t.false(frame.includes('Label 46'));
	r.unmount();
});
