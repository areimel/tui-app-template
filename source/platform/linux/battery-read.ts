import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import type {BatteryInfo} from '../types.js';
import {parsePowerSupplies, type RawSupply} from './battery-parse.js';

const FIELDS = [
	'type',
	'status',
	'capacity',
	'online',
	'scope',
	'energy_now',
	'energy_full',
	'power_now',
	'charge_now',
	'charge_full',
	'current_now',
	'voltage_now',
	'present',
] as const;

async function readSupply(root: string, name: string): Promise<RawSupply> {
	const fields: Record<string, string> = {};
	await Promise.all(
		FIELDS.map(async key => {
			try {
				const text = await readFile(path.join(root, name, key), 'utf8');
				fields[key] = text.trim();
			} catch {
				// Missing or unreadable (some files error with ENODEV): leave absent.
			}
		}),
	);
	return {name, fields};
}

/**
Read every power supply under `root`; never throws (unreadable root gives `[]`).
*/
export async function readPowerSupplies(
	root = '/sys/class/power_supply',
): Promise<RawSupply[]> {
	try {
		const entries = await readdir(root);
		const names = entries.toSorted();
		return await Promise.all(names.map(async name => readSupply(root, name)));
	} catch {
		return [];
	}
}

/**
Read and parse the Linux battery; `undefined` when there is none.
*/
export async function readLinuxBattery(
	root?: string,
): Promise<BatteryInfo | undefined> {
	return parsePowerSupplies(await readPowerSupplies(root));
}
