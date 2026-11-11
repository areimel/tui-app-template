/**
Saved Log Viewer settings: follow on start and the level filters.
*/
import {bool, defineSection, listOf, oneOf} from '../../config/section.js';
import {LEVELS, type Level} from './log-model.js';

export type LogViewerConfig = {
	readonly follow: boolean;
	readonly levels: readonly Level[];
};

export const LOG_VIEWER_CONFIG = defineSection<LogViewerConfig>(
	'apps.log-viewer',
	{follow: true, levels: []},
	{follow: bool(), levels: listOf(oneOf(LEVELS), LEVELS.length)},
);
