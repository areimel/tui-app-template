import process from 'node:process';
import type {Adapter} from './types.js';
import {createLinuxAdapter} from './linux/adapter.js';
import {createDarwinAdapter} from './darwin/adapter.js';
import {createUnsupportedAdapter, unsupportedMessage} from './unsupported.js';

export type SelectAdapterOptions = {
	platform?: NodeJS.Platform;
	env?: NodeJS.ProcessEnv;
};

/**
Pick the adapter for this platform. Linux WSL is reported unsupported by the adapter's own `detect()`.
*/
export function selectAdapter({
	platform = process.platform,
}: SelectAdapterOptions = {}): Adapter {
	if (platform === 'linux') {
		return createLinuxAdapter();
	}

	return platform === 'darwin'
		? createDarwinAdapter()
		: createUnsupportedAdapter(unsupportedMessage(platform, false));
}
