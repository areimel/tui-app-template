/**
The Tasks example: add and edit tasks in a dialog form, toggle them done, confirm deletes; saved to tasks.json.
*/
import {defineApp} from '../types.js';
import {Screen} from './Screen.js';

export const APP_ID = 'tasks';

export default defineApp({
	id: APP_ID,
	title: 'Tasks',
	description: 'A small task list saved to a data file',
	glyph: '✓',
	screen: Screen,
});
