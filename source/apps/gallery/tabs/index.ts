/**
The gallery tab registry: one entry per category, in display order.
*/
import type {ComponentType} from 'react';
import {DataTab} from './DataTab.js';
import {FormsTab} from './FormsTab.js';
import {IndicatorsTab} from './IndicatorsTab.js';
import {InputsTab} from './InputsTab.js';
import {LayoutTab} from './LayoutTab.js';
import {ListsTab} from './ListsTab.js';
import {OverlaysTab} from './OverlaysTab.js';
import {TextTab} from './TextTab.js';
import type {TabProps} from './types.js';

export type {DialogKind, TabProps} from './types.js';

export type GalleryTab = {
	readonly value: string;
	readonly label: string;
	/**
	Has keys of its own (enter goes inside the tab).
	*/
	readonly isInteractive: boolean;
	readonly content: ComponentType<TabProps>;
};

export const GALLERY_TABS: readonly GalleryTab[] = [
	{
		value: 'text',
		label: 'Text & status',
		isInteractive: false,
		content: TextTab,
	},
	{
		value: 'indicators',
		label: 'Indicators',
		isInteractive: false,
		content: IndicatorsTab,
	},
	{value: 'lists', label: 'Lists', isInteractive: true, content: ListsTab},
	{value: 'data', label: 'Data', isInteractive: true, content: DataTab},
	{value: 'inputs', label: 'Inputs', isInteractive: true, content: InputsTab},
	{value: 'forms', label: 'Forms', isInteractive: true, content: FormsTab},
	{
		value: 'overlays',
		label: 'Overlays',
		isInteractive: true,
		content: OverlaysTab,
	},
	{value: 'layout', label: 'Layout', isInteractive: true, content: LayoutTab},
];
