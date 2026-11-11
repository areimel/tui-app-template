/**
The System Monitor's saved settings: which column the process table sorts by, and the direction.
*/
import {defineSection, bool, oneOf} from '../../config/section.js';
import {SORT_KEYS, type SortState} from './monitor-model.js';

export const APP_ID = 'system-monitor';

export type MonitorConfig = SortState;

export const MONITOR_CONFIG = defineSection<MonitorConfig>(
	`apps.${APP_ID}`,
	{sortBy: 'cpu', isDescending: true},
	{sortBy: oneOf(SORT_KEYS), isDescending: bool()},
);
