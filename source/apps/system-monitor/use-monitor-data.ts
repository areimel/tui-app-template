/**
Live data for the screen: a CPU sample every second, the process list every two, the battery every ten.
Freezing stops all timers (the last values stay); `refresh` reads everything now.
*/
import {useCallback, useEffect, useRef, useState} from 'react';
import type {BatteryInfo, ProcessInfo} from '../../platform/types.js';
import {useServices} from '../../shell/context.js';
import {advanceSample, cleanProcesses, type Sample} from './monitor-model.js';

const SAMPLE_MS = 1000;
const PROCESS_MS = 2000;
const BATTERY_MS = 10_000;

export type MonitorData = {
	readonly sample: Sample;
	readonly processes: readonly ProcessInfo[];
	readonly hasLoadedProcesses: boolean;
	/**
	Why the last process-list read failed; the previous list stays visible.
	*/
	readonly processError: string | undefined;
	readonly battery: BatteryInfo | undefined;
	refresh(): void;
};

export function useMonitorData(isFrozen: boolean): MonitorData {
	const {system, battery: batteryService} = useServices();
	const [sample, setSample] = useState<Sample>(() =>
		advanceSample(undefined, system.readSnapshot()),
	);
	const [processes, setProcesses] = useState<readonly ProcessInfo[]>([]);
	const [hasLoadedProcesses, setHasLoadedProcesses] = useState(false);
	const [processError, setProcessError] = useState<string | undefined>();
	const [battery, setBattery] = useState<BatteryInfo | undefined>();
	const requestRef = useRef(0);

	const readSample = useCallback(() => {
		setSample(previous => advanceSample(previous, system.readSnapshot()));
	}, [system]);

	const loadProcesses = useCallback(() => {
		requestRef.current++;
		const request = requestRef.current;
		const finish = (
			list: readonly ProcessInfo[] | undefined,
			error: string | undefined,
		) => {
			if (request !== requestRef.current) {
				return;
			}

			if (list !== undefined) {
				setProcesses(list);
			}

			setProcessError(error);
			setHasLoadedProcesses(true);
		};

		system
			.listProcesses()
			.then(result => {
				if (result.isOk) {
					finish(cleanProcesses(result.value), undefined);
				} else {
					finish(undefined, result.error);
				}
			})
			.catch((error: unknown) => {
				finish(
					undefined,
					error instanceof Error ? error.message : String(error),
				);
			});
	}, [system]);

	const loadBattery = useCallback(() => {
		batteryService
			.read()
			.then(setBattery)
			.catch(() => {
				setBattery(undefined);
			});
	}, [batteryService]);

	useEffect(
		() => () => {
			requestRef.current++;
		},
		[],
	);

	useEffect(() => {
		if (isFrozen) {
			return;
		}

		const first = setTimeout(() => {
			loadProcesses();
			loadBattery();
		}, 0);
		const sampleTimer = setInterval(readSample, SAMPLE_MS);
		const processTimer = setInterval(loadProcesses, PROCESS_MS);
		const batteryTimer = setInterval(loadBattery, BATTERY_MS);
		return () => {
			clearTimeout(first);
			clearInterval(sampleTimer);
			clearInterval(processTimer);
			clearInterval(batteryTimer);
		};
	}, [isFrozen, readSample, loadProcesses, loadBattery]);

	const refresh = useCallback(() => {
		readSample();
		loadProcesses();
		loadBattery();
	}, [readSample, loadProcesses, loadBattery]);

	return {
		sample,
		processes,
		hasLoadedProcesses,
		processError,
		battery,
		refresh,
	};
}
