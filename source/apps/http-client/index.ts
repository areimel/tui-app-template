/**
The HTTP Client example: a request form, async send and cancel, Body/Headers/Raw tabs with a JSON tree, and history.
*/
import {defineApp} from '../types.js';
import {HTTP_BINDINGS} from './bindings.js';
import {APP_ID, HTTP_CONFIG} from './config.js';
import {Screen} from './Screen.js';

export {APP_ID} from './config.js';

export default defineApp({
	id: APP_ID,
	title: 'HTTP Client',
	description: 'Send requests and inspect the response as a JSON tree',
	glyph: '⇄',
	screen: Screen,
	bindings: HTTP_BINDINGS,
	config: HTTP_CONFIG,
});
