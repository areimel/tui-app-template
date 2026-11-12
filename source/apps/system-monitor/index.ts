/**
The System Monitor example: an htop-style view: per-core gauges, memory and swap, a load sparkline and a sortable, filterable process table.
*/
import {defineApp} from '../types.js';
import {ALL_MONITOR_BINDINGS} from './bindings.js';
import {APP_ID, MONITOR_CONFIG} from './config.js';
import {Screen} from './Screen.js';

export {APP_ID} from './config.js';

export default defineApp({
	id: APP_ID,
	title: 'System Monitor',
	description: 'Per-core CPU, memory and load, with a sortable process table',
	glyph: '◉',
	screen: Screen,
	bindings: ALL_MONITOR_BINDINGS,
	config: MONITOR_CONFIG,
});
