/**
Stub: owned by P1 (system service). Impure: `node:os`, `/proc/meminfo`, `ps`.
Replace the bodies; keep the exports and signatures.
*/
import os from 'node:os';
import {ok} from '../../core/result.js';
import type {SystemService} from '../types.js';
import {toCpuTimes} from './cpu.js';

export function createSystemService(): SystemService {
	return {
		readSnapshot() {
			const [one = 0, five = 0, fifteen = 0] = os.loadavg();
			return {
				hostname: os.hostname(),
				platform: os.platform(),
				uptimeSeconds: os.uptime(),
				loadAverage: [one, five, fifteen],
				cores: os.cpus().map(cpu => toCpuTimes(cpu.times)),
				memory: {
					totalBytes: os.totalmem(),
					usedBytes: os.totalmem() - os.freemem(),
					swapTotalBytes: undefined,
					swapUsedBytes: undefined,
				},
			};
		},
		listProcesses: async () => ok([]),
	};
}
