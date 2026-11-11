/**
The help overlay and the theme picker opened over the menu and every app (real `Shell`, real registry,
demo services) at `OVERLAY_SIZES`: the overlay shows and the screen still fits the terminal. Apps with
a service are covered by their own tests (see `size-matrix.test.tsx`).
*/
import test from 'ava';
import {APPS} from '../../source/apps/registry.js';
import {MENU_ROUTE} from '../../source/shell/types.js';
import {KEYS} from '../helpers/keys.js';
import {
	describeProblems,
	isShellFramed,
	mountAt,
	OVERLAY_SIZES,
	sizeProblems,
} from '../helpers/size-matrix.js';

const APPS_WITHOUT_SERVICE = APPS.filter(
	app => app.createService === undefined,
);
const ROUTES = [MENU_ROUTE.id, ...APPS_WITHOUT_SERVICE.map(app => app.id)];

const OVERLAYS = [
	{name: 'help', key: '?', marker: /Help/v},
	{name: 'theme picker', key: 't', marker: /Theme/v},
] as const;

for (const routeId of ROUTES) {
	for (const size of OVERLAY_SIZES) {
		for (const overlay of OVERLAYS) {
			const label = `${overlay.name} over ${routeId} at ${size.columns}x${size.rows}`;
			test(`${label} fits the terminal`, async t => {
				const shell = mountAt(APPS_WITHOUT_SERVICE, routeId, size);
				try {
					await shell.settle();
					await shell.press(overlay.key);
					const app = APPS.find(each => each.id === routeId);
					const lines = shell.lines();
					t.regex(lines.join('\n'), overlay.marker, `${label}: not shown`);
					const problems = sizeProblems(lines, size, isShellFramed(app, size));
					t.deepEqual(problems, [], describeProblems(label, lines, problems));
					await shell.press(KEYS.escape);
				} finally {
					shell.unmount();
				}
			});
		}
	}
}
