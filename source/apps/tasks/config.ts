/**
The Tasks config section (`apps.tasks` in the config file): the selected filter tab.
*/
import {defineSection, oneOf} from '../../config/section.js';
import {type TaskFilter, FILTERS} from './tasks-model.js';

export type TasksConfig = {
	readonly filter: TaskFilter;
};

const DEFAULTS: TasksConfig = {filter: 'all'};

export const TASKS_CONFIG = defineSection<TasksConfig>('apps.tasks', DEFAULTS, {
	filter: oneOf(FILTERS),
});
