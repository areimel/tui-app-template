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

const many = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map(label => ({
	value: label.toLowerCase(),
	label,
}));

test('Tabs windows a strip wider than width, with ‹ and › markers', t => {
	const r = renderThemed(<Tabs tabs={many} value="bravo" width={30} />);
	const frame = r.plainFrame();
	t.true([...frame.trimEnd()].length <= 30, frame);
	t.regex(frame, /^‹/v);
	t.regex(frame.trimEnd(), /›$/v);
	t.regex(frame, /\[ Bravo \]\s+Charlie/v);
	t.false(frame.includes('Alpha'));
	t.false(frame.includes('Delta'));
	r.unmount();
});

test('Tabs shows no markers when everything fits', t => {
	const r = renderThemed(<Tabs tabs={many} value="alpha" width={100} />);
	t.notRegex(r.plainFrame(), /[‹›]/v);
	t.regex(r.plainFrame(), /Echo/v);
	r.unmount();
});
