/**
The System Monitor example: an htop-style view: per-core gauges, memory and swap, a load sparkline and a sortable, filterable process table.
*/
import {defineApp} from '../types.js';
import {Screen} from './Screen.js';

export const APP_ID = 'system-monitor';

export default defineApp({
	id: APP_ID,
	title: 'System Monitor',
	description: 'Per-core CPU, memory and load, with a sortable process table',
	glyph: '◉',
	screen: Screen,
});
