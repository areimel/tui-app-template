/**
The File Explorer example: a read-only file browser: a list and a preview pane, hidden-file toggle, filter, and open-in-log-viewer.
*/
import {defineApp} from '../types.js';
import {Screen} from './Screen.js';

export const APP_ID = 'file-explorer';

export default defineApp({
	id: APP_ID,
	title: 'File Explorer',
	description: 'Browse folders read-only, with a preview pane and a filter',
	glyph: '▤',
	screen: Screen,
});
