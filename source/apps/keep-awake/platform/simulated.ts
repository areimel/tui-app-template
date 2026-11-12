import type {BatteryInfo} from '../../../platform/battery/types.js';
import type {Adapter, LockHandle, LockKind} from './types.js';

/**
The adapter used under `--demo`: it takes no OS lock and spawns nothing, so demo mode keeps its
promise of leaving the machine alone. Handles report the method `simulated`, which the status panel
shows, so the page never claims a real lock is held.
*/
export function createSimulatedAdapter(
	readBattery: () => Promise<BatteryInfo | undefined>,
): Adapter {
	const acquire = async (kind: LockKind): Promise<LockHandle> => {
		let isHeld = true;
		const release = () => {
			isHeld = false;
		};

		return {
			kind,
			method: 'simulated',
			isHeld: () => isHeld,
			onDied: () => () => undefined,
			async release() {
				release();
			},
			releaseSync: release,
		};
	};

	return {
		id: 'unsupported',
		async detect() {
			const battery = await readBattery();
			return {
				supported: true,
				system: {available: true, method: 'simulated'},
				display: {available: true, method: 'simulated'},
				battery: battery !== undefined,
			};
		},
		acquire,
		readBattery,
	};
}
