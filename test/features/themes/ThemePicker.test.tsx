import {setTimeout as delay} from 'node:timers/promises';
import test from 'ava';
import {ThemePicker} from '../../../source/features/themes/ThemePicker.js';
import type {ThemeName} from '../../../source/theme/tokens.js';
import {renderThemed} from '../../helpers/render-themed.js';

function setup(current: ThemeName, isActive = true) {
	const calls: string[] = [];
	const view = renderThemed(
		<ThemePicker
			current={current}
			isActive={isActive}
			onPreview={name => {
				calls.push(`preview:${name}`);
			}}
			onSelect={name => {
				calls.push(`select:${name}`);
			}}
			onCancel={() => {
				calls.push('cancel');
			}}
		/>,
	);
	const press = async (key: string) => {
		view.stdin.write(key);
		await delay(30);
	};

	return {view, calls, press};
}

test('lists themes with hints', t => {
	const {view} = setup('amber');
	const frame = view.plainFrame();
	for (const text of [
		'Theme',
		'Amber',
		'Green',
		'Severance',
		'amber phosphor',
		'blue office',
	]) {
		t.true(frame.includes(text), `has ${text}`);
	}

	view.unmount();
});

test('moving previews, Enter selects, Escape cancels', async t => {
	const {view, calls, press} = setup('amber');
	await press('\u{1B}[B');
	await press('j');
	await press('\u{1B}[A');
	await press('\r');
	await press('\u{1B}');
	t.deepEqual(calls, [
		'preview:green',
		'preview:green',
		'select:amber',
		'cancel',
	]);
	view.unmount();
});

test('the end of the list does not preview', async t => {
	const {view, calls, press} = setup('severance');
	await press('\u{1B}[B');
	t.deepEqual(calls, []);
	view.unmount();
});

test('inactive picker ignores keys', async t => {
	const {view, calls, press} = setup('amber', false);
	await press('\r');
	await press('\u{1B}[B');
	t.deepEqual(calls, []);
	view.unmount();
});
