import test from 'ava';
import {
	innerSize,
	planLayout,
} from '../../../source/apps/http-client/layout.js';

test('wide terminals put the panes side by side at full height', t => {
	const layout = planLayout(116, 38, 3);
	t.is(layout.mode, 'side');
	t.is(layout.request.height, 38);
	t.is(layout.request.width + layout.response.width, 116);
});

test('medium terminals stack the panes and the request hugs its fields', t => {
	const get = planLayout(76, 22, 3);
	t.is(get.mode, 'stacked');
	t.is(get.request.height, 5);
	t.is(get.request.height + get.response.height, 22);
	t.is(planLayout(56, 18, 4).request.height, 6);
});

test('tiny terminals show one pane at a time', t => {
	t.is(planLayout(36, 10, 3).mode, 'single');
	t.is(planLayout(100, 15, 3).mode, 'single');
	t.is(planLayout(43, 30, 3).mode, 'single');
});

test('innerSize removes borders and padding and never goes below 1', t => {
	t.deepEqual(innerSize({width: 40, height: 12}), {width: 36, height: 10});
	t.deepEqual(innerSize({width: 2, height: 1}), {width: 1, height: 1});
});
