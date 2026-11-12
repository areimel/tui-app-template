import type {BatteryInfo, BatteryStatus} from '../types.js';
import {clampPercent, parseNumber, toMinutes} from '../battery-util.js';

/**
One `/sys/class/power_supply` entry: its name and whichever small files exist.
*/
export type RawSupply = {
	name: string;
	fields: Record<string, string>;
};

type Measure = {now: number; full: number; rate: number | undefined};

type Battery = {
	status: BatteryStatus;
	percent: number | undefined;
	/**
	Energy (µWh, µW).
	*/
	energy: Measure | undefined;
	/**
	Charge (µAh, µA).
	*/
	charge: Measure | undefined;
	/**
	Power draw in µW.
	*/
	microwatts: number | undefined;
};

function field(supply: RawSupply, key: string): string | undefined {
	return supply.fields[key];
}

function number_(supply: RawSupply, key: string): number | undefined {
	return parseNumber(field(supply, key));
}

function positive(value: number | undefined): number | undefined {
	return value !== undefined && value > 0 ? value : undefined;
}

function mapStatus(text: string | undefined): BatteryStatus {
	switch (text?.trim().toLowerCase() ?? '') {
		case 'charging': {
			return 'charging';
		}

		case 'discharging': {
			return 'discharging';
		}

		case 'full': {
			return 'full';
		}

		case 'not charging': {
			return 'not-charging';
		}

		default: {
			return 'unknown';
		}
	}
}

function isBattery(supply: RawSupply): boolean {
	return (
		field(supply, 'type')?.trim() === 'Battery' &&
		field(supply, 'present')?.trim() !== '0' &&
		field(supply, 'scope')?.trim().toLowerCase() !== 'device'
	);
}

function measure(
	supply: RawSupply,
	nowKey: string,
	fullKey: string,
	rate: number | undefined,
): Measure | undefined {
	const now = number_(supply, nowKey);
	const full = positive(number_(supply, fullKey));
	return now === undefined || full === undefined
		? undefined
		: {now, full, rate: positive(rate)};
}

function toBattery(supply: RawSupply): Battery {
	const current = number_(supply, 'current_now');
	const voltage = number_(supply, 'voltage_now');
	const microwatts = positive(
		number_(supply, 'power_now') ??
			(current === undefined || voltage === undefined
				? undefined
				: Math.abs(current) * (Math.abs(voltage) / 1e6)),
	);
	const energy = measure(supply, 'energy_now', 'energy_full', microwatts);
	const charge = measure(
		supply,
		'charge_now',
		'charge_full',
		current === undefined ? undefined : Math.abs(current),
	);
	const capacity = number_(supply, 'capacity');
	const ratio =
		(energy ?? charge) &&
		((energy ?? charge)!.now / (energy ?? charge)!.full) * 100;
	return {
		status: mapStatus(field(supply, 'status')),
		percent: capacity ?? ratio,
		energy,
		charge,
		microwatts,
	};
}

function combineStatus(statuses: BatteryStatus[]): BatteryStatus {
	for (const wanted of ['charging', 'discharging', 'not-charging'] as const) {
		if (statuses.includes(wanted)) {
			return wanted;
		}
	}

	return statuses.every(status => status === 'full') ? 'full' : 'unknown';
}

function combinePercent(batteries: Battery[]): number | undefined {
	const weighted = batteries.map(b => ({
		percent: b.percent,
		weight: b.energy?.full ?? b.charge?.full,
	}));
	if (weighted.map(w => w.percent).includes(undefined)) {
		return undefined;
	}

	if (weighted.every(w => w.weight !== undefined)) {
		const weightSum = weighted.reduce((sum, w) => sum + (w.weight ?? 0), 0);
		let product = 0;
		for (const w of weighted) {
			const part = (w.percent ?? 0) * (w.weight ?? 0);
			product += part;
		}

		return product / weightSum;
	}

	return (
		weighted.reduce((acc, w) => acc + (w.percent ?? 0), 0) / weighted.length
	);
}

/**
Sum one unit family across batteries; `undefined` unless every battery has it.
*/
function sumMeasures(measures: Array<Measure | undefined>) {
	if (measures.length === 0 || measures.includes(undefined)) {
		return undefined;
	}

	const list = measures as Measure[];
	const rates = list.map(m => m.rate).filter(r => r !== undefined);
	return {
		now: list.reduce((sum, m) => sum + m.now, 0),
		full: list.reduce((sum, m) => sum + m.full, 0),
		rate: rates.length === 0 ? undefined : rates.reduce((a, b) => a + b, 0),
	};
}

function estimate(
	batteries: Battery[],
	status: BatteryStatus,
): number | undefined {
	const sum =
		sumMeasures(batteries.map(b => b.energy)) ??
		sumMeasures(batteries.map(b => b.charge));
	if (sum?.rate === undefined) {
		return undefined;
	}

	if (status === 'discharging') {
		return toMinutes((sum.now / sum.rate) * 60);
	}

	return status === 'charging'
		? toMinutes(((sum.full - sum.now) / sum.rate) * 60)
		: undefined;
}

function isAcOnline(supplies: RawSupply[], status: BatteryStatus): boolean {
	const mains = supplies.filter(s => field(s, 'type')?.trim() === 'Mains');
	const hasUsbOnline = supplies.some(
		s =>
			field(s, 'type')?.trim().startsWith('USB') === true &&
			field(s, 'online')?.trim() === '1',
	);
	const hasMainsOnline = mains.some(s => field(s, 'online')?.trim() === '1');
	const isInferred = ['charging', 'full', 'not-charging'].includes(status);
	return hasUsbOnline || (mains.length === 0 ? isInferred : hasMainsOnline);
}

/**
Combine `/sys/class/power_supply` entries into one reading; `undefined` when there is no battery.
*/
export function parsePowerSupplies(
	supplies: RawSupply[],
): BatteryInfo | undefined {
	const batteries = supplies.filter(s => isBattery(s)).map(s => toBattery(s));
	if (batteries.length === 0) {
		return undefined;
	}

	const status = combineStatus(batteries.map(b => b.status));
	const percent = combinePercent(batteries);
	const known = batteries.map(b => b.microwatts).filter(w => w !== undefined);
	const watts =
		known.length === 0 ? undefined : known.reduce((a, b) => a + b, 0) / 1e6;
	return {
		percent: percent === undefined ? 0 : clampPercent(percent),
		charging: status === 'charging',
		acOnline: isAcOnline(supplies, status),
		status,
		minutesToEmpty:
			status === 'discharging' ? estimate(batteries, status) : undefined,
		minutesToFull:
			status === 'charging' ? estimate(batteries, status) : undefined,
		watts,
	};
}
