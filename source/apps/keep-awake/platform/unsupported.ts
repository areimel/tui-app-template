import {APP} from '../../../app.config.js';
import type {Adapter} from './types.js';

/**
User-facing explanation of why this platform cannot run Keep Awake.
*/
export function unsupportedMessage(
	platform: NodeJS.Platform,
	isWsl: boolean,
): string {
	if (isWsl) {
		return `${APP.command} does not support WSL. Inhibitors on the Linux side cannot keep Windows awake. Run it on Linux or macOS directly.`;
	}

	return platform === 'win32'
		? `${APP.command} does not support Windows yet. It runs on Linux and macOS.`
		: `${APP.command} does not support ${platform}. It runs on Linux and macOS.`;
}

/**
Adapter for platforms we cannot run on: reports unsupported, takes no locks.
*/
export function createUnsupportedAdapter(message: string): Adapter {
	return {
		id: 'unsupported',
		async detect() {
			return {
				supported: false,
				message,
				system: {available: false, note: message},
				display: {available: false, note: message},
				battery: false,
			};
		},
		async acquire() {
			throw new Error(message);
		},
		async readBattery() {
			return undefined;
		},
	};
}
