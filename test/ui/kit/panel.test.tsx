import test from 'ava';
import {Panel, T} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

function lines(frame: string): string[] {
	return frame.split('\n').filter(line => line.trim() !== '');
}

test('titled Panel draws its title inside the top border', t => {
	const r = renderThemed(
		<Panel title="Session" width={30}>
			<T>body</T>
		</Panel>,
	);
	const all = lines(r.plainFrame());
	t.regex(all[0] ?? '', /^╭─ Session ─+╮/v);
	t.is(all.length, 3);
	r.unmount();
});

test('focused Panel title carries the marker in the top line', t => {
	const r = renderThemed(
		<Panel isFocused title="Options" width={30}>
			<T>body</T>
		</Panel>,
	);
	t.regex(lines(r.plainFrame())[0] ?? '', /^╭─ ❯ Options ─+╮/v);
	r.unmount();
});

test('top and bottom border lines have equal length', t => {
	for (const props of [
		{width: 30, height: 4},
		{width: 41, height: 6},
		{width: 25, height: 5, flexGrow: 1},
	]) {
		const r = renderThemed(
			<Panel title="Stats" {...props}>
				<T>body</T>
			</Panel>,
		);
		const all = lines(r.plainFrame());
		const last = all.at(-1) ?? '';
		t.is((all[0] ?? '').length, last.length);
		t.is(last.length, props.width);
		t.regex(last, /^╰─+╯$/v);
		t.is(all.length, props.height);
		r.unmount();
	}
});

test('untitled Panel keeps a plain top border', t => {
	const r = renderThemed(
		<Panel width={20}>
			<T>body</T>
		</Panel>,
	);
	const all = lines(r.plainFrame());
	t.regex(all[0] ?? '', /^╭─+╮$/v);
	t.is((all[0] ?? '').length, (all.at(-1) ?? '').length);
	r.unmount();
});
