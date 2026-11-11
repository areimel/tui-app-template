/**
`Router.canOpen` in the real `Shell`: true for a registered app on a supported platform, false for an
unknown id or an app limited to other platforms.
*/
import test from 'ava';
import {createAppConfigStore} from '../../source/config/app-config-store.js';
import {DEFAULTS} from '../../source/config/schema.js';
import {createConfigTracker} from '../../source/config/tracker.js';
import {createAppServiceRegistry} from '../../source/shell/app-services.js';
import {useRouter} from '../../source/shell/context.js';
import {Shell} from '../../source/shell/Shell.js';
import type {AppDefinition} from '../../source/shell/types.js';
import {T} from '../../source/ui/kit/T.js';
import {createFakeServices} from '../helpers/fake-services.js';
import {waitFor} from '../helpers/keys.js';
import {renderSized} from '../helpers/render-sized.js';

function Probe() {
	const router = useRouter();
	const answers = ['probe', 'elsewhere', 'missing'].map(
		id => `${id}=${String(router.canOpen(id))}`,
	);
	return <T>{answers.join(' ')}</T>;
}

const APPS: AppDefinition[] = [
	{id: 'probe', title: 'Probe', description: '', glyph: 'p', screen: Probe},
	{
		id: 'elsewhere',
		title: 'Elsewhere',
		description: '',
		glyph: 'e',
		screen: Probe,
		platforms: ['plan9'],
	},
];

test('canOpen knows the registry and the platform', async t => {
	const tracker = createConfigTracker(DEFAULTS);
	const saver = {
		schedule() {
			// In memory.
		},
		async flush() {
			// Nothing pending.
		},
	};
	const {services} = createFakeServices({platform: 'linux'});
	const appConfig = createAppConfigStore({tracker, schedule: saver.schedule});
	const view = renderSized(
		<Shell
			apps={APPS}
			services={services}
			tracker={tracker}
			saver={saver}
			appConfig={appConfig}
			appServices={createAppServiceRegistry({services, appConfig})}
			colorLevel={0}
			initialRoute={{id: 'probe'}}
			onExit={() => {
				// Not quitting.
			}}
		/>,
		80,
		24,
	);
	try {
		await waitFor(
			() => view.plainFrame().includes('probe='),
			'probe screen',
			15_000,
		);
		t.true(
			view.plainFrame().includes('probe=true elsewhere=false missing=false'),
		);
	} finally {
		view.unmount();
	}
});
