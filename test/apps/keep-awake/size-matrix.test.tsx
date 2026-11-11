/**
Keep Awake in the real `Shell` with the real registry, at every size in `MATRIX_SIZES` (and with the
help overlay and theme picker open at `OVERLAY_SIZES`): it fits the terminal, and so does the menu with
its Keep Awake row and badge. Its service runs over the fake lock adapter, so no real inhibitor is ever
taken. The generic size matrix (`test/shell/size-matrix.test.tsx`) leaves service-backed apps to their
own tests; this is Keep Awake's.
*/
import test, {type ExecutionContext} from 'ava';
import keepAwake from '../../../source/apps/keep-awake/index.js';
import {createKeepAwakeService} from '../../../source/apps/keep-awake/service.js';
import type {KeepAwakeConfig} from '../../../source/apps/keep-awake/config.js';
import {APPS} from '../../../source/apps/registry.js';
import {
	MENU_ROUTE,
	type AppDefinition,
	type ServiceContext,
} from '../../../source/shell/types.js';
import {KEYS} from '../../helpers/keys.js';
import {
	describeProblems,
	isShellFramed,
	MATRIX_SIZES,
	mountAt,
	OVERLAY_SIZES,
	sizeProblems,
	type Size,
} from '../../helpers/size-matrix.js';
import {createFakeAdapter} from './helpers/fake-adapter.js';

function appsWithFakeLocks(): AppDefinition[] {
	const adapter = createFakeAdapter();
	return APPS.map(app =>
		app.id === keepAwake.id
			? {
					...app,
					createService: context =>
						createKeepAwakeService(context as ServiceContext<KeepAwakeConfig>, {
							adapter,
							deps: {now: Date.now, isPidAlive: () => true},
						}),
				}
			: app,
	);
}

async function check(
	t: ExecutionContext,
	routeId: string,
	size: Size,
	overlayKey?: string,
) {
	const label = `${routeId}${overlayKey === undefined ? '' : ` + ${overlayKey}`} at ${size.columns}x${size.rows}`;
	const shell = mountAt(appsWithFakeLocks(), routeId, size);
	try {
		await shell.settle();
		if (overlayKey !== undefined) {
			await shell.press(overlayKey);
		}

		const lines = shell.lines();
		const isMenu = routeId === MENU_ROUTE.id;
		const problems = sizeProblems(
			lines,
			size,
			isMenu && isShellFramed(undefined, size),
		);
		t.deepEqual(problems, [], describeProblems(label, lines, problems));
		if (overlayKey !== undefined) {
			await shell.press(KEYS.escape);
		}
	} finally {
		shell.unmount();
	}
}

for (const size of MATRIX_SIZES) {
	test(`keep-awake at ${size.columns}x${size.rows} fits the terminal`, async t => {
		await check(t, keepAwake.id, size);
	});
	test(`the menu with Keep Awake at ${size.columns}x${size.rows} fits the terminal`, async t => {
		await check(t, MENU_ROUTE.id, size);
	});
}

for (const size of OVERLAY_SIZES) {
	for (const key of ['?', 't']) {
		test(`keep-awake with ${key} open at ${size.columns}x${size.rows} fits`, async t => {
			await check(t, keepAwake.id, size, key);
		});
	}
}
