/**
The File Explorer example: a read-only file browser: a list and a preview pane, hidden-file toggle, filter, and open-in-log-viewer.
*/
import {LIST_NAV_BINDINGS} from '../../ui/hooks/use-list-nav.js';
import {defineApp} from '../types.js';
import {EXPLORER_BINDINGS} from './bindings.js';
import {EXPLORER_CONFIG, EXPLORER_ID} from './config.js';
import {Screen} from './Screen.js';

export const APP_ID = EXPLORER_ID;

export default defineApp({
	id: APP_ID,
	title: 'File Explorer',
	description: 'Browse folders read-only, with a preview pane and a filter',
	glyph: '▤',
	screen: Screen,
	bindings: [...LIST_NAV_BINDINGS, ...EXPLORER_BINDINGS],
	config: EXPLORER_CONFIG,
});
