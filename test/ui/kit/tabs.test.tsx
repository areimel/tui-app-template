import test from 'ava';
import {Tabs} from '../../../source/ui/kit/Tabs.js';
import {renderThemed} from '../../helpers/render-themed.js';

const tabs = [
	{value: 'body', label: 'Body'},
	{value: 'headers', label: 'Headers'},
] as const;

test('Tabs brackets the selected tab on one row', t => {
	const r = renderThemed(<Tabs tabs={tabs} value="headers" />);
	const frame = r.plainFrame();
	t.false(frame.includes('\n'));
	t.regex(frame, /Body\s+\[ Headers \]/v);
	r.unmount();
});

test('Tabs marks the first tab when selected and focused', t => {
	const a = renderThemed(<Tabs isFocused tabs={tabs} value="body" />);
	const b = renderThemed(<Tabs tabs={tabs} value="headers" />);
	t.regex(a.plainFrame(), /\[ Body \]\s+Headers/v);
	t.regex(b.plainFrame(), /Body/v);
	a.unmount();
	b.unmount();
});
