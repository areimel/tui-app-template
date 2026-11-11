/**
Stub: owned by I1 (shell entry). Composes the real services; `cli.tsx` calls it once.
Replace the body if needed; keep the export and signature.
*/
import process from 'node:process';
import {createDataService} from '../config/json-store.js';
import {createBatteryService} from './battery/battery-service.js';
import {createFsService} from './fs/fs-service.js';
import {createHttpService} from './http/http-service.js';
import {createSystemService} from './system/system-read.js';
import type {Services} from './types.js';

export type ServicesOptions = {
	/**
	Folder for app data files (the config file's folder, see `config/paths.ts` `dataDir`).
	*/
	readonly dataDir: string;
	readonly onWarning?: (warning: string) => void;
};

export function createServices({
	dataDir,
	onWarning,
}: ServicesOptions): Services {
	return {
		system: createSystemService(),
		fs: createFsService(),
		http: createHttpService(),
		battery: createBatteryService(),
		data: createDataService(
			dataDir,
			onWarning === undefined ? {} : {onWarning},
		),
		now: () => Date.now(),
		platform: process.platform,
	};
}
