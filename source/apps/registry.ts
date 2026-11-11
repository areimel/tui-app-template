/**
The one list of example apps, in menu order. Adding an example: create `apps/<id>/` with an `index.ts`
default-exporting `defineApp({...})`, then add one line here. Removing one: delete the folder, its line
here, its tests (`test/apps/<id>/`) and its site guide page.
*/
import fileExplorer from './file-explorer/index.js';
import gallery from './gallery/index.js';
import httpClient from './http-client/index.js';
import logViewer from './log-viewer/index.js';
import systemMonitor from './system-monitor/index.js';
import tasks from './tasks/index.js';
import type {AppDefinition} from './types.js';

export const APPS: readonly AppDefinition[] = [
	systemMonitor,
	fileExplorer,
	logViewer,
	tasks,
	httpClient,
	gallery,
	// Wave 2 (KA) adds Keep Awake here: `keepAwake,` with `import keepAwake from './keep-awake/index.js';`
];

/**
The app with this id, or `undefined`.
*/
export function findApp(id: string): AppDefinition | undefined {
	return APPS.find(app => app.id === id);
}
