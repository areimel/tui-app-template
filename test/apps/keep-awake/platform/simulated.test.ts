import test from 'ava';
import {createSimulatedAdapter} from '../../../../source/apps/keep-awake/platform/simulated.js';

test('simulated adapter reports both locks available without a battery', async t => {
	const adapter = createSimulatedAdapter(async () => undefined);
	const capabilities = await adapter.detect();
	t.true(capabilities.supported);
	t.is(capabilities.system.method, 'simulated');
	t.is(capabilities.display.method, 'simulated');
	t.false(capabilities.battery);
});

test('simulated locks are held until released and say they are simulated', async t => {
	const adapter = createSimulatedAdapter(async () => undefined);
	const system = await adapter.acquire('system', 'demo');
	const display = await adapter.acquire('display', 'demo');
	t.is(system.method, 'simulated');
	t.true(system.isHeld());
	await system.release();
	t.false(system.isHeld());
	display.releaseSync();
	display.releaseSync();
	t.false(display.isHeld());
});
