/**
The Tasks example: add and edit tasks in a dialog form, toggle them done, confirm deletes; saved to tasks.json.
*/
import {defineApp} from '../types.js';
import {TASKS_BINDINGS} from './bindings.js';
import {APP_ID, TASKS_CONFIG} from './config.js';
import {Screen} from './Screen.js';

export {APP_ID} from './config.js';

export default defineApp({
	id: APP_ID,
	title: 'Tasks',
	description: 'A small task list saved to a data file',
	glyph: '✓',
	screen: Screen,
	bindings: TASKS_BINDINGS,
	config: TASKS_CONFIG,
});
