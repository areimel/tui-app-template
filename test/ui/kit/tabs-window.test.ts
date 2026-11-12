import test from 'ava';
import {tabsWindow, TAB_CHROME} from '../../../source/ui/kit/tabs-window.js';

const labels = ['One', 'Two', 'Three', 'Four', 'Five'];
const cost = (label: string) => label.length + TAB_CHROME;
const total = labels.reduce((sum, label) => sum + cost(label), 0);

test('everything fits: the whole strip and no markers', t => {
	t.deepEqual(tabsWindow(labels, 2, total), {
		start: 0,
		end: 5,
		hasMarkers: false,
	});
	t.deepEqual(tabsWindow(labels, 0, undefined), {
		start: 0,
		end: 5,
		hasMarkers: false,
	});
});

test('too wide: a window around the selection that fits beside the markers', t => {
	const width = 2 + cost('Three') + cost('Four');
	t.deepEqual(tabsWindow(labels, 2, width), {
		start: 2,
		end: 4,
		hasMarkers: true,
	});
	t.deepEqual(tabsWindow(labels, 4, width), {
		start: 3,
		end: 5,
		hasMarkers: true,
	});
	t.deepEqual(tabsWindow(labels, 0, width), {
		start: 0,
		end: 2,
		hasMarkers: true,
	});
});

test('the selected tab is always in the window, even when nothing fits', t => {
	t.deepEqual(tabsWindow(labels, 3, 3), {start: 3, end: 4, hasMarkers: true});
	t.deepEqual(tabsWindow([], 0, 10), {start: 0, end: 0, hasMarkers: false});
});
