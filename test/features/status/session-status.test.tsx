import test from 'ava';
import {SessionStatus} from '../../../source/features/status/SessionStatus.js';
import {renderThemed} from '../../helpers/render-themed.js';
import {makeState, NOW} from '../state-fixture.js';

test('shows AWAKE and both lock badges with methods', t => {
	const r = renderThemed(
		<SessionStatus
			now={NOW + 5000}
			state={makeState({
				phase: 'awake',
				locks: {
					system: {status: 'held', method: 'systemd-inhibit'},
					display: {status: 'held', method: 'gnome-session-inhibit'},
				},
			})}
		/>,
	);
	const frame = r.plainFrame();
	for (const text of [
		'AWAKE',
		'00:00:05',
		'no limit',
		'System systemd-inhibit',
		'Display gnome-session-inhibit',
	]) {
		t.true(frame.includes(text), `has ${text}`);
	}

	r.unmount();
});

test('shows the stop reason, PID and notes', t => {
	const r = renderThemed(
		<SessionStatus
			now={NOW}
			state={makeState({
				phase: 'stopped',
				stopReason: 'pid-exited',
				options: {...makeState().options, pid: 77},
				notes: ['No battery found'],
			})}
		/>,
	);
	const frame = r.plainFrame();
	for (const text of [
		'STOPPED',
		'Watched process exited',
		'77',
		'No battery found',
	]) {
		t.true(frame.includes(text), `has ${text}`);
	}

	r.unmount();
});
