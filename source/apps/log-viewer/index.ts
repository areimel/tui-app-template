/**
The Log Viewer example: follow a file (or a demo generator), search with next/previous, and filter by level.
*/
import {defineApp} from '../types.js';
import {APP_ID, LOG_VIEWER_CONFIG, type LogViewerConfig} from './config.js';
import {LOG_BINDINGS} from './keys.js';
import {Screen} from './Screen.js';

export {APP_ID} from './config.js';

export default defineApp<LogViewerConfig>({
	id: APP_ID,
	title: 'Log Viewer',
	description: 'Follow a log file, search it and filter by level',
	glyph: '≡',
	screen: Screen,
	bindings: LOG_BINDINGS,
	config: LOG_VIEWER_CONFIG,
});
