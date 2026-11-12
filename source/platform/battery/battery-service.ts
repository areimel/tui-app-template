/**
The battery service over the existing readers (`linux/battery-read.ts`, `darwin/battery-read.ts`).
*/
import process from 'node:process';
import type {BatteryService} from '../types.js';
import {readDarwinBattery} from './darwin/battery-read.js';
import {readLinuxBattery} from './linux/battery-read.js';

export function createBatteryService(
	platform: string = process.platform,
): BatteryService {
	switch (platform) {
		case 'linux': {
			return {read: async () => readLinuxBattery()};
		}

		case 'darwin': {
			return {read: async () => readDarwinBattery()};
		}

		default: {
			return {read: async () => undefined};
		}
	}
}
