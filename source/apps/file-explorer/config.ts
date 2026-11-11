/**
The File Explorer's saved settings: hidden files and sort order (config section `apps.file-explorer`).
*/
import {bool, defineSection, oneOf} from '../../config/section.js';
import type {EntrySort} from '../../platform/fs/entries.js';
import {SORTS} from './explorer-model.js';

export const EXPLORER_ID = 'file-explorer';

export type ExplorerConfig = {
	readonly showHidden: boolean;
	readonly sort: EntrySort;
};

export const EXPLORER_CONFIG = defineSection<ExplorerConfig>(
	`apps.${EXPLORER_ID}`,
	{showHidden: false, sort: 'name'},
	{showHidden: bool(), sort: oneOf<EntrySort>(SORTS)},
);
