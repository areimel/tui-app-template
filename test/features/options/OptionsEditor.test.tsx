import {setTimeout as delay} from 'node:timers/promises';
import test from 'ava';
import type {SessionOptions} from '../../../source/core/session/types.js';
import {OptionsEditor} from '../../../source/features/options/OptionsEditor.js';
import type {OptionPatch} from '../../../source/features/options/option-fields.js';
import {renderThemed} from '../../helpers/render-themed.js';

const DOWN = '\u{1B}[B';
const UP = '\u{1B}[A';
const RIGHT = '\u{1B}[C';
const LEFT = '\u{1B}[D';
const ENTER = '\r';
const ESC = '\u{1B}';

const base: SessionOptions = {
	end: {mode: 'duration', ms: 3_600_000},
	display: false,
	acOnly: false,
	minBattery: 10,
	pid: undefined,
};
const battery = {
	percent: 50,
	charging: false,
	acOnline: true,
	status: 'full',
	minutesToEmpty: undefined,
	minutesToFull: undefined,
	watts: undefined,
} as const;

type Setup = {
	options?: SessionOptions;
	hasBattery?: boolean;
	isActive?: boolean;
};

function setup({
	options = base,
	hasBattery = true,
	isActive = true,
}: Setup = {}) {
	const patches: OptionPatch[] = [];
	const editing: boolean[] = [];
	const view = renderThemed(
		<OptionsEditor
			options={options}
			capabilities={undefined}
			battery={hasBattery ? battery : undefined}
			isActive={isActive}
			isPidAlive={pid => pid === 42}
			onChange={patch => {
				patches.push(patch);
			}}
			onEditingChange={isEditing => {
				editing.push(isEditing);
			}}
		/>,
	);
	const press = async (...keys: string[]) => {
		for (const key of keys) {
			view.stdin.write(key);
			// eslint-disable-next-line no-await-in-loop
			await delay(30);
		}
	};

	return {view, patches, editing, press};
}

const cursorLine = (frame: string) =>
	frame.split('\n').find(line => line.includes('❯')) ?? '';

test('cursor moves with arrows and j/k', async t => {
	const {view, press} = setup();
	t.regex(cursorLine(view.plainFrame()), /Mode/v);
	await press(DOWN);
	t.regex(cursorLine(view.plainFrame()), /Duration/v);
	await press('j', 'k', 'k');
	t.regex(cursorLine(view.plainFrame()), /Mode/v);
	await press(UP);
	t.regex(cursorLine(view.plainFrame()), /Mode/v);
	view.unmount();
});

test('right on Mode emits the next end and left wraps', async t => {
	const {view, patches, press} = setup();
	await press(RIGHT, LEFT);
	t.deepEqual(patches, [
		{end: {mode: 'until', clock: '17:00'}},
		{end: {mode: 'indefinite'}},
	]);
	view.unmount();
});

test('duration row appears and disappears with the mode', t => {
	const timer = setup();
	t.regex(timer.view.plainFrame(), /Duration/v);
	timer.view.unmount();
	const indefinite = setup({options: {...base, end: {mode: 'indefinite'}}});
	t.notRegex(indefinite.view.plainFrame(), /Duration/v);
	indefinite.view.unmount();
});

test('editing Duration commits on Return', async t => {
	const {view, patches, editing, press} = setup();
	await press(DOWN, ENTER);
	t.deepEqual(editing, [true]);
	await press('\u{7F}', '\u{7F}', '\u{7F}', '4', '5', 'm');
	await press(ENTER);
	t.deepEqual(patches, [{end: {mode: 'duration', ms: 2_700_000}}]);
	t.deepEqual(editing, [true, false]);
	view.unmount();
});

test('a bad value shows the error, keeps editing and Escape cancels', async t => {
	const {view, patches, editing, press} = setup();
	await press(DOWN, ENTER, 'z', ENTER);
	t.regex(view.plainFrame(), /Try 45m, 1h30m or 2h/v);
	t.deepEqual(patches, []);
	t.deepEqual(editing, [true]);
	await press(ESC);
	t.deepEqual(editing, [true, false]);
	t.notRegex(view.plainFrame(), /Try 45m/v);
	t.deepEqual(patches, []);
	view.unmount();
});

test('Enter on Display toggles', async t => {
	const {view, patches, press} = setup();
	await press(DOWN, DOWN, ENTER);
	t.deepEqual(patches, [{display: true}]);
	view.unmount();
});

test('left and right step Min battery', async t => {
	const {view, patches, press} = setup();
	await press(DOWN, DOWN, DOWN, DOWN, RIGHT, LEFT);
	t.deepEqual(patches, [{minBattery: 15}, {minBattery: 5}]);
	view.unmount();
});

test('PID edit validates through isPidAlive', async t => {
	const {view, patches, press} = setup();
	await press(DOWN, DOWN, DOWN, DOWN, DOWN, ENTER, '9', ENTER);
	t.regex(view.plainFrame(), /No such process/v);
	await press('\u{7F}', '4', '2', ENTER);
	t.deepEqual(patches, [{pid: 42}]);
	view.unmount();
});

test('disabled rows show the hint and ignore changes', async t => {
	const {view, patches, press} = setup({hasBattery: false});
	t.regex(view.plainFrame(), /No battery detected/v);
	await press(DOWN, DOWN, DOWN, ENTER, RIGHT);
	t.regex(cursorLine(view.plainFrame()), /AC only/v);
	await press(DOWN, RIGHT);
	t.deepEqual(patches, []);
	view.unmount();
});

test('inactive editor ignores keys', async t => {
	const {view, patches, press} = setup({isActive: false});
	await press(DOWN, RIGHT, ENTER);
	t.deepEqual(patches, []);
	t.is(cursorLine(view.plainFrame()), '');
	view.unmount();
});

test('cursor stays valid when rows disappear', async t => {
	const {view, press} = setup();
	await press(DOWN, DOWN, DOWN, DOWN, DOWN, DOWN);
	view.rerender(
		<OptionsEditor
			isActive
			options={{...base, end: {mode: 'indefinite'}}}
			capabilities={undefined}
			battery={battery}
			isPidAlive={() => true}
			onChange={() => undefined}
		/>,
	);
	await delay(30);
	t.regex(cursorLine(view.plainFrame()), /Wait PID/v);
	view.unmount();
});
