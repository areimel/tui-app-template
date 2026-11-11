/**
Battery types shared by the platform battery readers and any app that shows battery state.
*/

/**
Normalised battery charge state.
*/
export type BatteryStatus =
	'charging' | 'discharging' | 'full' | 'not-charging' | 'unknown';

/**
One battery reading. Readers return `undefined` instead when the machine has no battery.
*/
export type BatteryInfo = {
	/**
	Charge level, 0–100 (may be fractional).
	*/
	percent: number;
	/**
	True only while actively charging (`status === 'charging'`).
	*/
	charging: boolean;
	/**
	 Mains power connected. On Linux this comes from the Mains `online` file,
	 not from battery status (a plugged-in machine can read `Not charging`).
	 */
	acOnline: boolean;
	status: BatteryStatus;
	/**
	Estimated minutes until empty; `undefined` when unknown or not discharging (e.g. `power_now = 0`).
	*/
	minutesToEmpty: number | undefined;
	/**
	Estimated minutes until full; `undefined` when unknown or not charging.
	*/
	minutesToFull: number | undefined;
	/**
	Current power draw in watts; `undefined` when unknown.
	*/
	watts: number | undefined;
};
