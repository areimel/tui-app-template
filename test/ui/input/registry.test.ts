import test from 'ava';
import {createInputRegistry} from '../../../source/ui/input/registry.js';
import type {Key, KeyBinding} from '../../../source/ui/input/index.js';

const NONE: Key = {
	upArrow: false,
	downArrow: false,
	leftArrow: false,
	rightArrow: false,
	pageDown: false,
	pageUp: false,
	home: false,
	end: false,
	return: false,
	escape: false,
	ctrl: false,
	shift: false,
	tab: false,
	backspace: false,
	delete: false,
	meta: false,
	super: false,
	hyper: false,
	capsLock: false,
	numLock: false,
};

const QUIT: KeyBinding = {action: 'quit', keys: ['q'], label: 'quit'};
const BACK: KeyBinding = {action: 'back', keys: ['esc'], label: 'back'};
const SELECT: KeyBinding = {action: 'select', keys: ['q', 'x'], label: 'pick'};

function setup() {
	const registry = createInputRegistry();
	const log: string[] = [];
	const bind = (
		scope: ReturnType<typeof registry.createScope>,
		bindings: readonly KeyBinding[],
		name: string,
		isGlobal = false,
	) =>
		registry.addBindings({
			scope,
			isGlobal,
			bindings,
			run(action) {
				log.push(`${name}:${action}`);
			},
		});
	const raw = (
		scope: ReturnType<typeof registry.createScope>,
		name: string,
		isCapturing = false,
	) =>
		registry.addHandler({
			scope,
			isCapturing,
			handle(input) {
				log.push(`${name}<${input}`);
			},
		});
	const press = (input: string, flags: Partial<Key> = {}) => {
		registry.dispatch(input, {...NONE, ...flags});
	};

	return {registry, log, bind, raw, press};
}

test('scope bindings win over globals for the same key', t => {
	const {registry, log, bind, press} = setup();
	const screen = registry.createScope('screen', 'screen');
	registry.mountScope(screen);
	bind(registry.root, [QUIT], 'global', true);
	bind(screen, [SELECT], 'screen');
	press('q');
	press('x');
	t.deepEqual(log, ['screen:select', 'screen:select']);
});

test('globals run when the top scope has no match', t => {
	const {registry, log, bind, press} = setup();
	const screen = registry.createScope('screen', 'screen');
	registry.mountScope(screen);
	bind(registry.root, [QUIT], 'global', true);
	bind(screen, [BACK], 'screen');
	press('q');
	t.deepEqual(log, ['global:quit']);
});

test('only the most recent screen scope is reachable', t => {
	const {registry, log, bind, press} = setup();
	const first = registry.createScope('first', 'screen');
	const second = registry.createScope('second', 'screen');
	registry.mountScope(first);
	const unmount = registry.mountScope(second);
	bind(first, [SELECT], 'first');
	bind(second, [SELECT], 'second');
	press('x');
	unmount();
	press('x');
	t.deepEqual(log, ['second:select', 'first:select']);
});

test('a modal blocks screen bindings and globals', t => {
	const {registry, log, bind, raw, press} = setup();
	const screen = registry.createScope('screen', 'screen');
	const modal = registry.createScope('dialog', 'modal');
	registry.mountScope(screen);
	bind(registry.root, [QUIT], 'global', true);
	bind(screen, [SELECT], 'screen');
	raw(screen, 'screen-raw');
	registry.mountScope(modal);
	bind(modal, [BACK], 'dialog');
	press('q');
	press('x');
	press('', {escape: true});
	t.deepEqual(log, ['dialog:back']);
});

test('a later modal sits above an earlier one, even if mounted under a screen', t => {
	const {registry, log, bind, press} = setup();
	const lower = registry.createScope('lower', 'modal');
	const screen = registry.createScope('screen', 'screen');
	const upper = registry.createScope('upper', 'modal');
	registry.mountScope(lower);
	registry.mountScope(screen);
	const closeUpper = registry.mountScope(upper);
	bind(lower, [BACK], 'lower');
	bind(upper, [BACK], 'upper');
	press('', {escape: true});
	closeUpper();
	press('', {escape: true});
	t.deepEqual(log, ['upper:back', 'lower:back']);
});

test('a capturing handler takes every key in its scope', t => {
	const {registry, log, bind, raw, press} = setup();
	const screen = registry.createScope('screen', 'screen');
	registry.mountScope(screen);
	bind(registry.root, [QUIT], 'global', true);
	bind(screen, [SELECT], 'screen');
	raw(screen, 'other');
	const stop = raw(screen, 'text', true);
	press('q');
	stop();
	press('q');
	t.deepEqual(log, ['text<q', 'screen:select']);
});

test('raw handlers get keys no binding claimed', t => {
	const {registry, log, bind, raw, press} = setup();
	bind(registry.root, [QUIT], 'global', true);
	raw(registry.root, 'raw');
	press('q');
	press('j');
	t.deepEqual(log, ['global:quit', 'raw<j']);
});

test('ctrl+c goes to the latest interrupt handler, even while capturing', t => {
	const {registry, log, raw, press} = setup();
	raw(registry.root, 'text', true);
	registry.addInterrupt(() => {
		log.push('outer');
	});
	const remove = registry.addInterrupt(() => {
		log.push('inner');
	});
	press('c', {ctrl: true});
	remove();
	press('c', {ctrl: true});
	t.deepEqual(log, ['inner', 'outer']);
});

test('release events are ignored', t => {
	const {registry, log, bind, press} = setup();
	bind(registry.root, [QUIT], 'global', true);
	press('q', {eventType: 'release'});
	t.deepEqual(log, []);
});

test('snapshot lists reachable, screen and global bindings', t => {
	const {registry, bind, raw} = setup();
	const screen = registry.createScope('screen', 'screen');
	registry.mountScope(screen);
	bind(registry.root, [QUIT], 'global', true);
	bind(screen, [SELECT], 'screen');
	const first = registry.getSnapshot();
	t.is(registry.getSnapshot(), first, 'cached until a change');
	t.deepEqual(first.reachable, [SELECT, QUIT]);
	t.deepEqual(first.screen, [SELECT]);
	t.deepEqual(first.global, [QUIT]);
	t.false(first.isModalOpen);

	const modal = registry.createScope('dialog', 'modal');
	const close = registry.mountScope(modal);
	bind(modal, [BACK], 'dialog');
	const withModal = registry.getSnapshot();
	t.deepEqual(withModal.reachable, [BACK]);
	t.deepEqual(withModal.screen, [SELECT]);
	t.true(withModal.isModalOpen);

	const stop = raw(modal, 'text', true);
	t.deepEqual(registry.getSnapshot().reachable, []);
	t.true(registry.getSnapshot().isCapturing);
	stop();
	close();
	t.deepEqual(registry.getSnapshot().reachable, [SELECT, QUIT]);
});

test('subscribers hear every registration change', t => {
	const {registry, bind} = setup();
	let calls = 0;
	registry.subscribe(() => {
		calls++;
	});
	const remove = bind(registry.root, [QUIT], 'root');
	remove();
	t.is(calls, 2);
});
