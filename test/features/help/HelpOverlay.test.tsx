import {setTimeout as delay} from 'node:timers/promises';
import test from 'ava';
import {HelpOverlay} from '../../../source/features/help/HelpOverlay.js';
import {renderThemed} from '../../helpers/render-themed.js';

const bindings = [
	{keys: '↑↓', label: 'move'},
	{keys: 'Space', label: 'pause'},
];

test('renders bindings and the exit note', t => {
	const view = renderThemed(
		<HelpOverlay isActive bindings={bindings} onClose={() => undefined} />,
	);
	const frame = view.plainFrame();
	t.regex(frame, /Help/v);
	t.regex(frame, /↑↓\s+move/v);
	t.regex(frame, /Space\s+pause/v);
	t.regex(frame, /stop condition/v);
	view.unmount();
});

test('Escape, ?, Enter and q close; other keys do not', async t => {
	let closed = 0;
	const view = renderThemed(
		<HelpOverlay
			isActive
			bindings={bindings}
			onClose={() => {
				closed++;
			}}
		/>,
	);
	for (const key of ['\u{1B}', '?', '\r', 'q', 'x', 'j']) {
		view.stdin.write(key);
		// eslint-disable-next-line no-await-in-loop
		await delay(30);
	}

	t.is(closed, 4);
	view.unmount();
});

test('inactive overlay ignores keys', async t => {
	let closed = 0;
	const view = renderThemed(
		<HelpOverlay
			isActive={false}
			bindings={bindings}
			onClose={() => {
				closed++;
			}}
		/>,
	);
	view.stdin.write('q');
	await delay(30);
	t.is(closed, 0);
	view.unmount();
});
