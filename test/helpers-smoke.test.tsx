import test from 'ava';
import {Text} from 'ink';
import {useTheme} from '../source/theme/context.js';
import type {ResolvedTheme} from '../source/theme/tokens.js';
import {createFakeClock, FAKE_CLOCK_START} from './helpers/fake-clock.js';
import {renderThemed} from './helpers/render-themed.js';

test('fake clock drives timers without touching globals', async t => {
	const clock = createFakeClock();
	t.is(clock.now(), FAKE_CLOCK_START);
	let ticks = 0;
	let isFired = false;
	const interval = clock.setInterval(() => {
		ticks++;
	}, 1000);
	clock.setTimeout(() => {
		isFired = true;
	}, 1500);
	clock.tick(2000);
	t.is(ticks, 2);
	t.true(isFired);
	clock.clearInterval(interval);
	await clock.tickAsync(5000);
	t.is(ticks, 2);
	t.is(clock.now(), FAKE_CLOCK_START + 7000);
	t.true(Math.abs(Date.now() - FAKE_CLOCK_START) > 1000);
});

function Probe() {
	const theme = useTheme();
	const {accent} = theme.colors;
	return (
		<Text {...(accent === undefined ? {} : {color: accent})}>
			hello {theme.label}
		</Text>
	);
}

test('renderThemed renders with the plain theme by default', t => {
	const {plainFrame} = renderThemed(<Probe />);
	t.is(plainFrame(), 'hello Plain');
});

test('renderThemed passes a custom theme and keeps it on rerender', t => {
	const theme: ResolvedTheme = {
		name: 'green',
		label: 'Green',
		colorLevel: 3,
		colors: {
			accent: '#33FF66',
			accentDim: undefined,
			text: undefined,
			muted: undefined,
			border: undefined,
			ok: undefined,
			warn: undefined,
			err: undefined,
			bg: undefined,
		},
	};
	const {plainFrame, rerender} = renderThemed(<Probe />, theme);
	t.is(plainFrame(), 'hello Green');
	rerender(<Probe />);
	t.is(plainFrame(), 'hello Green');
});
