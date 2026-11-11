import test from 'ava';
import {AnimatedCup} from '../../../source/features/cup/AnimatedCup.js';
import {CoffeeCup} from '../../../source/features/cup/CoffeeCup.js';
import {renderThemed} from '../../helpers/render-themed.js';

const frameOf = (frame: number, isHot: boolean) => {
	const r = renderThemed(<CoffeeCup frame={frame} isHot={isHot} />);
	const text = r.plainFrame();
	r.unmount();
	return text;
};

test('hot frames differ but keep the same height', t => {
	const a = frameOf(0, true);
	const b = frameOf(5, true);
	t.not(a, b);
	t.is(a.split('\n').length, b.split('\n').length);
});

test('frames wrap around the loop', t => {
	t.is(frameOf(24, true), frameOf(0, true));
});

test('cold cup has blank steam rows and the same height', t => {
	const cold = frameOf(5, false).split('\n');
	t.is(cold.length, frameOf(0, true).split('\n').length);
	t.true(cold.slice(0, 7).every(row => row.trim() === ''));
	t.true(cold.join('\n').includes('░'));
});

test('a still AnimatedCup equals CoffeeCup frame 0', t => {
	const r = renderThemed(<AnimatedCup isHot isAnimated={false} />);
	const text = r.plainFrame();
	r.unmount();
	t.is(text, frameOf(0, true));
});
