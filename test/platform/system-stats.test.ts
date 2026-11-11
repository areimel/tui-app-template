import test from 'ava';
import {readSystemStats} from '../../source/platform/system-stats.js';

test('readSystemStats returns sane values', t => {
	const stats = readSystemStats();
	t.true(stats.uptimeSeconds > 0);
	t.is(stats.loadAverage.length, 3);
	t.true(stats.loadAverage.every(n => Number.isFinite(n) && n >= 0));
	t.true(stats.hostname.length > 0);
});
