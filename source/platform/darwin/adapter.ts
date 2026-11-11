import fs from 'node:fs/promises';
import process from 'node:process';
import {spawnLock, type SpawnFunction} from '../spawn-lock.js';
import type {
	Adapter,
	Avail,
	BatteryInfo,
	Capabilities,
	LockHandle,
	LockKind,
} from '../types.js';
import {readDarwinBattery} from './battery-read.js';

const CAFFEINATE_PATH = '/usr/bin/caffeinate';

export type DarwinAdapterDeps = {
	spawn?: SpawnFunction;
	nodePid?: number;
	readBattery?: () => Promise<BatteryInfo | undefined>;
	hasCaffeinate?: () => Promise<boolean>;
};

/**
Arguments for `caffeinate`. `-w <nodePid>` ties the lock to this process, so it
is dropped even when node is killed with SIGKILL.
*/
export function caffeinateArgs(kind: LockKind, nodePid: number): string[] {
	const flag = kind === 'system' ? '-i' : '-d';
	return [flag, '-w', String(nodePid)];
}

const isCaffeinateInstalled = async (): Promise<boolean> =>
	fs
		.access(CAFFEINATE_PATH)
		.then(() => true)
		.catch(() => false);

/**
Build the macOS adapter. Locks are `caffeinate` children tied to the node pid.
*/
export function createDarwinAdapter(deps: DarwinAdapterDeps = {}): Adapter {
	const {
		spawn,
		nodePid = process.pid,
		readBattery = readDarwinBattery,
		hasCaffeinate = isCaffeinateInstalled,
	} = deps;

	const caffeinateAvail = async (): Promise<Avail> =>
		(await hasCaffeinate())
			? {available: true, method: 'caffeinate'}
			: {available: false, note: 'caffeinate not found'};

	return {
		id: 'darwin',

		async detect(): Promise<Capabilities> {
			try {
				const [avail, battery] = await Promise.all([
					caffeinateAvail(),
					readBattery().catch((): undefined => undefined),
				]);
				return {
					supported: true,
					system: avail,
					display: avail,
					battery: battery !== undefined,
				};
			} catch {
				return {
					supported: true,
					system: {available: false, note: 'caffeinate not found'},
					display: {available: false, note: 'caffeinate not found'},
					battery: false,
				};
			}
		},

		async acquire(kind: LockKind): Promise<LockHandle> {
			return spawnLock({
				kind,
				method: 'caffeinate',
				command: 'caffeinate',
				args: caffeinateArgs(kind, nodePid),
				...(spawn !== undefined && {spawn}),
			});
		},

		async readBattery(): Promise<BatteryInfo | undefined> {
			return readBattery();
		},
	};
}
