/**
The real `Shell` with the real registry and the demo services: the menu and every app, at every size in
`MATRIX_SIZES`, never draws a line wider than the terminal or more lines than it has rows, and a page
the shell frames fills the terminal exactly.

Apps with a long-lived service (`createService`) are left out here, because their service may take real
OS resources; each of them has its own size test with fakes (Keep Awake:
`test/apps/keep-awake/size-matrix.test.tsx`).
*/
import test from 'ava';
import {APPS} from '../../source/apps/registry.js';
import {MENU_ROUTE} from '../../source/shell/types.js';
import {
	describeProblems,
	isShellFramed,
	MATRIX_SIZES,
	mountAt,
	sizeProblems,
} from '../helpers/size-matrix.js';

const APPS_WITHOUT_SERVICE = APPS.filter(
	app => app.createService === undefined,
);
const ROUTES = [MENU_ROUTE.id, ...APPS_WITHOUT_SERVICE.map(app => app.id)];

for (const routeId of ROUTES) {
	for (const size of MATRIX_SIZES) {
		const label = `${routeId} at ${size.columns}x${size.rows}`;
		test(`${label} fits the terminal`, async t => {
			const shell = mountAt(APPS_WITHOUT_SERVICE, routeId, size);
			try {
				await shell.settle();
				const app = APPS.find(each => each.id === routeId);
				const lines = shell.lines();
				const problems = sizeProblems(lines, size, isShellFramed(app, size));
				t.deepEqual(problems, [], describeProblems(label, lines, problems));
			} finally {
				shell.unmount();
			}
		});
	}
}
