import test from 'ava';
import {render} from 'ink-testing-library';
import {Text} from 'ink';
import type {
	SessionController,
	SessionListener,
	SessionState,
} from '../../../source/core/session/types.js';
import {useSession} from '../../../source/ui/hooks/use-session.js';

const delay = async (ms: number) =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

test('useSession re-renders when the controller notifies', async t => {
	let state = {phase: 'starting'} as unknown as SessionState;
	const listeners = new Set<SessionListener>();
	const controller = {
		getState: () => state,
		subscribe(listener: SessionListener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	} as unknown as SessionController;

	function Probe() {
		return <Text>phase:{useSession(controller).phase}</Text>;
	}

	const {lastFrame, unmount} = render(<Probe />);
	t.is(lastFrame(), 'phase:starting');

	state = {phase: 'awake'} as unknown as SessionState;
	for (const listener of listeners) {
		listener(state);
	}

	await delay(30);
	t.is(lastFrame(), 'phase:awake');
	unmount();
	t.is(listeners.size, 0);
});
