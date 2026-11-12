/**
The Keep Awake example: the original coffee-term dashboard, now a service-backed page. Opening it starts
keeping the machine awake (system lock, plus the display lock when asked); the session keeps running
while other pages are open and releases on quit, signals and crashes. `chrome: 'bare'`: it draws its
own frame, heading art, cup and layout planner over the whole terminal.
*/
import {defineApp} from '../types.js';
import {KEEP_AWAKE_BINDINGS} from './bindings.js';
import {KEEP_AWAKE_CLI} from './cli.js';
import {APP_ID, KEEP_AWAKE_CONFIG} from './config.js';
import {MenuBadge} from './MenuBadge.js';
import {Screen} from './Screen.js';
import {createKeepAwakeService} from './service.js';

export {APP_ID} from './config.js';

export default defineApp({
	id: APP_ID,
	title: 'Keep Awake',
	description: 'Keeps the machine awake, with a live dashboard',
	glyph: '☼',
	chrome: 'bare',
	screen: Screen,
	bindings: KEEP_AWAKE_BINDINGS,
	config: KEEP_AWAKE_CONFIG,
	createService: context => createKeepAwakeService(context),
	menuBadge: MenuBadge,
	cli: KEEP_AWAKE_CLI,
	platforms: ['linux', 'darwin'],
});
