import test from 'ava';
import {
	Badge,
	FieldRow,
	KeyHints,
	NumberField,
	Panel,
	ProgressBar,
	SelectList,
	StatRow,
	T,
	Toggle,
	toneProps,
} from '../../../source/ui/kit/index.js';
import {PLAIN_THEME} from '../../../source/theme/context.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('T renders its children', t => {
	const r = renderThemed(<T bold>hello</T>);
	t.is(r.plainFrame(), 'hello');
	r.unmount();
});

test('toneProps returns the theme colour or nothing', t => {
	const theme = {
		...PLAIN_THEME,
		colorLevel: 3 as const,
		colors: {...PLAIN_THEME.colors, accent: '#ffb000'},
	};
	t.deepEqual(toneProps(theme, 'accent'), {color: '#ffb000'});
	t.deepEqual(toneProps(theme, 'muted'), {});
});

test('Panel renders title and children; focus adds a marker', t => {
	const plain = renderThemed(
		<Panel title="Stats">
			<T>body</T>
		</Panel>,
	);
	t.regex(plain.plainFrame(), /Stats/v);
	t.regex(plain.plainFrame(), /body/v);
	t.notRegex(plain.plainFrame(), /❯/v);
	plain.unmount();

	const focused = renderThemed(
		<Panel isFocused title="Stats">
			<T>body</T>
		</Panel>,
	);
	t.regex(focused.plainFrame(), /❯ Stats/v);
	focused.unmount();
});

test('FieldRow shows label, value, hint and the focus gutter marker', t => {
	const r = renderThemed(
		<FieldRow isFocused label="Duration" hint="(why)">
			<T>45m</T>
		</FieldRow>,
	);
	t.regex(r.plainFrame(), /^❯ Duration 45m \(why\)/v);
	r.rerender(
		<FieldRow isDisabled label="Duration">
			<T>45m</T>
		</FieldRow>,
	);
	t.is(r.plainFrame().trimEnd(), '  Duration 45m');
	r.unmount();
});

test('Toggle on and off differ in text', t => {
	const on = renderThemed(<Toggle isOn />);
	const off = renderThemed(<Toggle isOn={false} />);
	t.regex(on.plainFrame(), /\[ ● on \]/v);
	t.regex(off.plainFrame(), /\[ ○ off \]/v);
	t.not(on.plainFrame(), off.plainFrame());
	on.unmount();
	off.unmount();
});

test('Toggle uses custom labels', t => {
	const r = renderThemed(<Toggle isOn onLabel="AC only" />);
	t.regex(r.plainFrame(), /AC only/v);
	r.unmount();
});

const items = [
	{value: 'a', label: 'Alpha', hint: 'first'},
	{value: 'b', label: 'Beta'},
	{value: 'c', label: 'Gamma'},
] as const;

test('SelectList marks highlighted and committed rows', t => {
	const r = renderThemed(
		<SelectList isFocused items={items} value="a" highlighted="b" />,
	);
	const lines = r.plainFrame().split('\n');
	t.regex(lines[0] ?? '', /^ {2}● Alpha first/v);
	t.regex(lines[1] ?? '', /^❯ ○ Beta/v);
	t.regex(lines[2] ?? '', /^ {2}○ Gamma/v);
	r.unmount();
});

test('SelectList hides the cursor when unfocused', t => {
	const r = renderThemed(
		<SelectList items={items} value="a" highlighted="b" />,
	);
	t.notRegex(r.plainFrame(), /❯/v);
	r.unmount();
});

test('NumberField renders values, units and the empty label', t => {
	const r = renderThemed(<NumberField value={20} unit="%" />);
	t.regex(r.plainFrame(), /\[ 20% \]/v);
	r.rerender(<NumberField value={undefined} />);
	t.regex(r.plainFrame(), /\[ off \]/v);
	r.rerender(<NumberField value={undefined} emptyLabel="none" />);
	t.regex(r.plainFrame(), /\[ none \]/v);
	r.unmount();
});

test('StatRow renders label and string or node value', t => {
	const r = renderThemed(<StatRow label="Uptime" value="2h" labelWidth={8} />);
	t.regex(r.plainFrame(), /^Uptime {3}2h/v);
	r.rerender(<StatRow label="Lock" value={<T>held</T>} />);
	t.regex(r.plainFrame(), /Lock held/v);
	r.unmount();
});

test('ProgressBar renders filled and empty cells', t => {
	const r = renderThemed(<ProgressBar value={0.5} width={10} />);
	t.is(r.plainFrame(), '█████░░░░░');
	r.unmount();
});

test('Badge glyph follows state', t => {
	const states = [
		['ok', '●'],
		['warn', '▲'],
		['err', '✕'],
		['off', '○'],
	] as const;
	for (const [state, glyph] of states) {
		const r = renderThemed(
			<Badge state={state} label="System" detail="inhibit" />,
		);
		t.is(r.plainFrame(), `${glyph} System inhibit`);
		r.unmount();
	}
});

test('KeyHints joins pairs with two spaces and truncates to maxWidth', t => {
	const hints = [
		{keys: 'q', label: 'quit'},
		{keys: '?', label: 'help'},
	];
	const r = renderThemed(<KeyHints hints={hints} />);
	t.is(r.plainFrame(), 'q quit  ? help');
	r.rerender(<KeyHints hints={hints} maxWidth={8} />);
	t.is(r.plainFrame().length, 8);
	t.regex(r.plainFrame(), /…$/v);
	r.unmount();
});
