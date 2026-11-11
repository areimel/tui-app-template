/**
The Component Gallery example: tabs per kit category showing every component, with live theme cycling.
*/
import {defineApp} from '../types.js';
import {Screen} from './Screen.js';

export const APP_ID = 'gallery';

export default defineApp({
	id: APP_ID,
	title: 'Component Gallery',
	description: 'Every kit component, by category, with live theme cycling',
	glyph: '◆',
	screen: Screen,
});
