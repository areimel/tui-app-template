/**
The Tasks example: add and edit tasks in a dialog form, toggle them done, confirm deletes; saved to tasks.json.
*/
import {defineApp} from '../types.js';
import {TASKS_BINDINGS} from './bindings.js';
import {TASKS_CONFIG} from './config.js';
import {Screen} from './Screen.js';

export const APP_ID = 'tasks';

export default defineApp({
	id: APP_ID,
	title: 'Tasks',
	description: 'A small task list saved to a data file',
	glyph: '✓',
	screen: Screen,
	bindings: TASKS_BINDINGS,
	config: TASKS_CONFIG,
});
