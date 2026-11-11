/**
The HTTP Client example: a request form, async send and cancel, Body/Headers/Raw tabs with a JSON tree, and history.
*/
import {defineApp} from '../types.js';
import {Screen} from './Screen.js';

export const APP_ID = 'http-client';

export default defineApp({
	id: APP_ID,
	title: 'HTTP Client',
	description: 'Send requests and inspect the response as a JSON tree',
	glyph: '⇄',
	screen: Screen,
});
