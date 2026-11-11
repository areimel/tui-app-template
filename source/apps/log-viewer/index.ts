/**
The Log Viewer example: follow a file (or a demo generator), search with next/previous, and filter by level.
*/
import {defineApp} from '../types.js';
import {Screen} from './Screen.js';

export const APP_ID = 'log-viewer';

export default defineApp({
	id: APP_ID,
	title: 'Log Viewer',
	description: 'Follow a log file, search it and filter by level',
	glyph: '≡',
	screen: Screen,
});
