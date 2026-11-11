/**
State and key handling of the File Explorer screen: the loaded folder, the cursor, the preview, the
filter and the focused pane. Navigation never drops the folder on screen until the next one has loaded,
so a permission error leaves the previous folder usable.
*/
import {useEffect, useMemo, useRef, useState} from 'react';
import {fail, ok} from '../../core/result.js';
import {arrangeEntries, isDirectoryLike} from '../../platform/fs/entries.js';
import type {DirEntry} from '../../platform/types.js';
import {
	useAppConfig,
	useRouter,
	useScreenSize,
	useServices,
	useToast,
} from '../../shell/context.js';
import {useAsync} from '../../ui/hooks/use-async.js';
import {useListNav} from '../../ui/hooks/use-list-nav.js';
import {useKeys} from '../../ui/input/index.js';
import {EXPLORER_BINDINGS} from './bindings.js';
import {EXPLORER_CONFIG, EXPLORER_ID} from './config.js';
import {
	baseName,
	explorerLayout,
	nextSort,
	parentPath,
	PREVIEW_MAX_BYTES,
	rememberCursor,
	restoreIndex,
	sortOptions,
	type CursorMemory,
	type Pane,
} from './explorer-model.js';
import type {PreviewResult} from './PreviewPane.js';

type Loaded = {
	readonly path: string;
	readonly entries: readonly DirEntry[];
};

type Pending = {readonly path: string; readonly name: string | undefined};

export function useExplorer() {
	const services = useServices();
	const router = useRouter();
	const toast = useToast();
	const size = useScreenSize();
	const [config, updateConfig] = useAppConfig(EXPLORER_ID, EXPLORER_CONFIG);
	const [pane, setPane] = useState<Pane>('list');
	const [isFiltering, setIsFiltering] = useState(false);
	const [filter, setFilter] = useState({path: '', text: ''});
	const [dir, setDir] = useState<Loaded | undefined>();
	const memoryRef = useRef<CursorMemory>(new Map());
	const pendingRef = useRef<Pending | undefined>(undefined);

	const load = useAsync<Loaded, string, [string]>(async (_signal, path) => {
		const result = await services.fs.list(path);
		return result.isOk ? ok({path, entries: result.value}) : fail(result.error);
	});
	const previewLoad = useAsync<PreviewResult, string, [string]>(
		async (_signal, path) => {
			const result = await services.fs.preview(path, PREVIEW_MAX_BYTES);
			return result.isOk
				? ok({path, preview: result.value})
				: fail(result.error);
		},
	);

	if (load.state.status === 'done' && load.state.value !== dir) {
		setDir(load.state.value);
	}

	const filterText = filter.path === dir?.path ? filter.text : '';
	const rows = useMemo(
		() =>
			dir === undefined
				? []
				: arrangeEntries(dir.entries, {
						...sortOptions(config.sort),
						showHidden: config.showHidden,
						filter: filterText,
					}),
		[dir, config.sort, config.showHidden, filterText],
	);
	const layout = explorerLayout(size, pane);
	const isListActive = pane === 'list' && layout.showList && !isFiltering;

	const nav = useListNav({
		count: rows.length,
		pageSize: Math.max(1, layout.innerRows - 1),
		isActive: isListActive,
		onSelect(index) {
			openAt(index);
		},
	});
	const selected = rows[nav.cursor];
	const selectedPath = selected?.path;

	// Start the initial load once.
	useEffect(() => {
		load.start(router.current.params?.['path'] ?? services.fs.cwd());
		// eslint-disable-next-line react-hooks/exhaustive-deps -- Mount only.
	}, []);

	// Preview the selection while a preview pane is visible.
	useEffect(() => {
		if (selectedPath !== undefined && layout.showPreview) {
			previewLoad.start(selectedPath);
		} else {
			previewLoad.cancel();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- Keyed by the path.
	}, [selectedPath, layout.showPreview]);

	// Place the cursor once the wanted folder (or re-sorted list) is on screen.
	useEffect(() => {
		const wanted = pendingRef.current;
		if (wanted === undefined || dir?.path !== wanted.path) {
			return;
		}

		pendingRef.current = undefined;
		nav.setCursor(restoreIndex(rows, wanted.name));
	});

	function go(target: string, name?: string) {
		if (dir !== undefined && selected !== undefined) {
			memoryRef.current = rememberCursor(
				memoryRef.current,
				dir.path,
				selected.name,
			);
		}

		pendingRef.current = {
			path: target,
			name: name ?? memoryRef.current.get(target),
		};
		setPane('list');
		load.start(target);
	}

	function openAt(index: number) {
		const entry = rows[index];
		if (entry === undefined) {
			return;
		}

		if (isDirectoryLike(entry)) {
			go(entry.path);
		} else {
			setPane('preview');
		}
	}

	function keepSelection() {
		if (dir !== undefined) {
			pendingRef.current = {path: dir.path, name: selected?.name};
		}
	}

	const previewState = previewLoad.state;
	const known =
		selected !== undefined &&
		previewState.status === 'done' &&
		previewState.value.path === selected.path
			? previewState.value.preview
			: undefined;

	useKeys(
		EXPLORER_BINDINGS,
		{
			open() {
				if (pane === 'list') {
					openAt(nav.cursor);
				}
			},
			parent() {
				if (pane === 'preview') {
					setPane('list');
				} else if (dir !== undefined && parentPath(dir.path) !== dir.path) {
					go(parentPath(dir.path), baseName(dir.path));
				}
			},
			home() {
				go(services.fs.home());
			},
			switchPane() {
				setPane(pane === 'list' ? 'preview' : 'list');
			},
			filter() {
				if (dir === undefined) {
					return;
				}

				setPane('list');
				setIsFiltering(true);
			},
			toggleHidden() {
				keepSelection();
				updateConfig({showHidden: !config.showHidden});
			},
			cycleSort() {
				keepSelection();
				updateConfig({sort: nextSort(config.sort)});
			},
			openLog() {
				if (
					selected === undefined ||
					isDirectoryLike(selected) ||
					known?.kind === 'binary'
				) {
					toast('Select a text file to open in the Log Viewer', 'warn');
					return;
				}

				router.push({id: 'log-viewer', params: {path: selected.path}});
			},
		},
		{isActive: !isFiltering},
	);

	return {
		size,
		layout,
		pane,
		config,
		home: services.fs.home(),
		dir,
		rows,
		cursor: nav.cursor,
		selected,
		loadState: load.state,
		previewState,
		isFiltering,
		filterText,
		setFilterText(text: string) {
			if (dir === undefined) {
				return;
			}

			setFilter({path: dir.path, text});
			nav.setCursor(0);
		},
		endFilter(isClearing: boolean) {
			if (isClearing && dir !== undefined) {
				setFilter({path: dir.path, text: ''});
			}

			setIsFiltering(false);
		},
	};
}
