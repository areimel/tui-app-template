/**
The Tasks config section (`apps.tasks` in the config file): the selected filter tab.
*/
import {defineSection, oneOf} from '../../config/section.js';
import {type TaskFilter, FILTERS} from './tasks-model.js';

export type TasksConfig = {
	readonly filter: TaskFilter;
};

export const APP_ID = 'tasks';

const DEFAULTS: TasksConfig = {filter: 'all'};

export const TASKS_CONFIG = defineSection<TasksConfig>(
	`apps.${APP_ID}`,
	DEFAULTS,
	{
		filter: oneOf(FILTERS),
	},
);
