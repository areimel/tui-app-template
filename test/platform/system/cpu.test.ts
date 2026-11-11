import test from 'ava';
import {cpuUsage, toCpuTimes} from '../../../source/platform/system/cpu.js';

test('toCpuTimes sums every field into total and keeps idle', t => {
	t.deepEqual(toCpuTimes({user: 10, nice: 1, sys: 5, idle: 80, irq: 4}), {
		idle: 80,
		total: 100,
	});
});

test('cpuUsage is the busy fraction per core', t => {
	const previous = [
		{idle: 100, total: 200},
		{idle: 0, total: 100},
	];
	const next = [
		{idle: 150, total: 300},
		{idle: 0, total: 200},
	];
	t.deepEqual(cpuUsage(previous, next), [0.5, 1]);
});

test('cpuUsage reads 0 on the first sample', t => {
	t.deepEqual(cpuUsage([], [{idle: 5, total: 10}]), [0]);
});

test('cpuUsage handles a core count change in both directions', t => {
	const two = [
		{idle: 0, total: 0},
		{idle: 0, total: 0},
	];
	t.deepEqual(cpuUsage(two, [{idle: 50, total: 100}]), [0.5]);
	t.deepEqual(
		cpuUsage(
			[{idle: 0, total: 0}],
			[
				{idle: 50, total: 100},
				{idle: 50, total: 100},
			],
		),
		[0.5, 0],
	);
});

test('cpuUsage reads 0 for zero or negative elapsed time', t => {
	const sample = {idle: 10, total: 20};
	t.deepEqual(cpuUsage([sample], [sample]), [0]);
	t.deepEqual(cpuUsage([{idle: 10, total: 30}], [sample]), [0]);
});

test('cpuUsage clamps into 0..1', t => {
	t.deepEqual(cpuUsage([{idle: 0, total: 0}], [{idle: 20, total: 10}]), [0]);
});
