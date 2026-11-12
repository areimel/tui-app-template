/**
The File Explorer screen: path line, a directory list and a preview pane (side by side from 80 columns,
else one at a time with Tab), and a status line with the error, the filter or a summary.
*/
import {Box} from 'ink';
import {SearchInput, StatusBar, T} from '../../ui/kit/index.js';
import {DirList} from './DirList.js';
import {breadcrumb} from './explorer-model.js';
import {PreviewPane} from './PreviewPane.js';
import {useExplorer} from './use-explorer.js';

export function Screen() {
	const x = useExplorer();
	const {columns, rows: height} = x.size;
	const {layout} = x;
	const isFilterShown = x.isFiltering || x.filterText !== '';

	let left;
	if (x.loadState.status === 'failed') {
		left = (
			<T tone="err" wrap="truncate-end">
				{`✗ ${x.loadState.error}`}
			</T>
		);
	} else if (isFilterShown) {
		left = (
			<SearchInput
				value={x.filterText}
				isActive={x.isFiltering}
				placeholder="filter"
				width={Math.max(1, columns - 24)}
				matchCount={x.rows.length}
				onChange={x.setFilterText}
				onSubmit={() => {
					x.endFilter(false);
				}}
				onCancel={() => {
					x.endFilter(true);
				}}
			/>
		);
	} else if (x.loadState.status === 'loading' && x.dir === undefined) {
		left = <T tone="muted">Loading…</T>;
	} else {
		left = (
			<T tone="muted" wrap="truncate-end">
				{`${x.rows.length} ${x.rows.length === 1 ? 'item' : 'items'}`}
			</T>
		);
	}

	const arrow = x.config.sort === 'name' ? '↑' : '↓';
	const right = (
		<T tone="muted">
			{`sort: ${x.config.sort} ${arrow}  hidden: ${x.config.showHidden ? 'on' : 'off'}`}
		</T>
	);

	return (
		<Box flexDirection="column" width={columns} height={height}>
			<T bold tone="accent" wrap="truncate-end">
				{x.dir === undefined ? ' ' : breadcrumb(x.dir.path, x.home, columns)}
			</T>
			<Box height={layout.paneHeight}>
				{layout.showList && (
					<DirList
						rows={x.rows}
						cursor={x.cursor}
						width={layout.listWidth}
						height={layout.paneHeight}
						isFocused={x.pane === 'list'}
						emptyText={x.filterText === '' ? '(empty)' : '(no matches)'}
					/>
				)}
				{layout.showPreview && (
					<PreviewPane
						entry={x.selected}
						state={x.previewState}
						width={layout.previewWidth}
						height={layout.paneHeight}
						isFocused={x.pane === 'preview'}
					/>
				)}
			</Box>
			<StatusBar left={left} right={right} width={columns} />
		</Box>
	);
}
