/**
A finished response: status line, Body / Headers / Raw tabs and their content. Owns the tab, the tree's
expand state and the scroll offset; mount it with a `key` per response so they reset.
*/
import {useMemo, useState} from 'react';
import {Box} from 'ink';
import {formatBytes, formatMillis} from '../../core/format.js';
import type {HttpResponse} from '../../platform/types.js';
import {useListNav, useScroll} from '../../ui/hooks/index.js';
import {useKeys} from '../../ui/input/index.js';
import {Badge, StatusBar, T, Tabs} from '../../ui/kit/index.js';
import {flattenTree} from '../../ui/kit/tree-model.js';
import {RESPONSE_BINDINGS} from './bindings.js';
import {JsonTree, TextRows} from './BodyViews.js';
import {statusBadge} from './request-model.js';
import {
	allParents,
	bodyView,
	headersText,
	parentIndex,
	RESPONSE_TABS,
	rawText,
	topLevelParents,
	wrapRows,
	type ResponseTab,
} from './response-model.js';

export type ResponseViewProps = {
	readonly response: HttpResponse;
	/**
	Drawing area inside the pane.
	*/
	readonly width: number;
	readonly height: number;
	/**
	The Response pane has focus (keys are registered only then).
	*/
	readonly isActive: boolean;
};

const TAB_VALUES = RESPONSE_TABS.map(tab => tab.value);

export function ResponseView({
	response,
	width,
	height,
	isActive,
}: ResponseViewProps) {
	const bodyRows = Math.max(1, height - 2);
	const textWidth = Math.max(1, width - 1);
	const view = useMemo(() => bodyView(response), [response]);
	const nodes = view.kind === 'tree' ? view.nodes : [];
	const [tab, setTab] = useState<ResponseTab>('body');
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(() =>
		topLevelParents(nodes),
	);
	const isTree = tab === 'body' && view.kind === 'tree';
	const rows = flattenTree(nodes, expanded);

	const lines = useMemo(() => {
		switch (tab) {
			case 'headers': {
				return wrapRows(headersText(response.headers), textWidth);
			}

			case 'raw': {
				return wrapRows(rawText(response), textWidth);
			}

			case 'body': {
				return wrapRows(view.kind === 'text' ? view.text : '', textWidth);
			}
		}
	}, [tab, response, view, textWidth]);

	const toggle = (id: string) => {
		setExpanded(previous => {
			const next = new Set(previous);
			if (!next.delete(id)) {
				next.add(id);
			}

			return next;
		});
	};

	const nav = useListNav({
		count: rows.length,
		pageSize: bodyRows - 1,
		isActive: isActive && isTree,
		onSelect(index) {
			const row = rows[index];
			if (row?.hasChildren === true) {
				toggle(row.node.id);
			}
		},
	});
	const scroll = useScroll({
		contentRows: lines.length,
		viewportRows: bodyRows,
		isActive: isActive && !isTree,
	});

	const changeTab = (direction: number) => {
		const index = TAB_VALUES.indexOf(tab) + direction;
		const next = TAB_VALUES[(index + TAB_VALUES.length) % TAB_VALUES.length];
		if (next === undefined) {
			return;
		}

		setTab(next);
		scroll.scrollTo(0);
	};

	const row = rows[nav.cursor];
	useKeys(
		RESPONSE_BINDINGS,
		{
			previous() {
				if (!isTree || row === undefined) {
					changeTab(-1);
				} else if (row.isExpanded) {
					toggle(row.node.id);
				} else {
					const parent = parentIndex(rows, nav.cursor);
					if (parent === undefined) {
						changeTab(-1);
					} else {
						nav.setCursor(parent);
					}
				}
			},
			next() {
				if (isTree && row?.hasChildren === true && !row.isExpanded) {
					toggle(row.node.id);
				} else {
					changeTab(1);
				}
			},
			expandAll() {
				setExpanded(allParents(nodes));
			},
			collapseAll() {
				setExpanded(new Set());
				nav.setCursor(0);
			},
		},
		{isActive},
	);

	const {state, label} = statusBadge(response.status, response.statusText);
	return (
		<Box flexDirection="column" width={width} height={height}>
			<StatusBar
				width={width}
				left={<Badge state={state} label={label} />}
				right={
					<T tone="muted">
						{formatMillis(response.durationMs)} ·{' '}
						{formatBytes(response.sizeBytes)}
					</T>
				}
			/>
			<Tabs
				tabs={RESPONSE_TABS}
				value={tab}
				isFocused={isActive}
				width={width}
			/>
			{isTree ? (
				<JsonTree
					nodes={nodes}
					expanded={expanded}
					cursorId={row?.node.id}
					height={bodyRows}
					width={width}
				/>
			) : (
				<TextRows
					lines={lines}
					offset={scroll.offset}
					height={bodyRows}
					width={width}
				/>
			)}
		</Box>
	);
}
