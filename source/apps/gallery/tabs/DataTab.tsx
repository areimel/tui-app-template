/**
Data: Table and Tree. Inside, left/right pick one, up/down move, enter/space sort or expand.
*/
import {useState} from 'react';
import {useListNav} from '../../../ui/hooks/index.js';
import {useKeys, type KeyBinding} from '../../../ui/input/index.js';
import {flattenTree, jsonToTree, Table, Tree} from '../../../ui/kit/index.js';
import {Sample} from '../Sample.js';
import {FILE_COLUMNS, FILE_ROWS, TREE_JSON} from '../samples.js';
import type {TabProps} from './types.js';

type DataAction = 'switch' | 'act';

const DATA_BINDINGS: ReadonlyArray<KeyBinding<DataAction>> = [
	{action: 'switch', keys: ['left', 'right', 'h', 'l'], label: 'other sample'},
	{action: 'act', keys: ['space'], label: 'sort or expand'},
];

const NODES = jsonToTree(TREE_JSON);
const TABLE_HEIGHT = 5;
const TREE_HEIGHT = 5;
const MAX_TABLE = 46;

export function DataTab({width, isInside}: TabProps) {
	const [isTreeFocused, setIsTreeFocused] = useState(false);
	const [isDescending, setIsDescending] = useState(false);
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set(['$.tags']),
	);

	const rows = isDescending ? FILE_ROWS.toReversed() : FILE_ROWS;
	const visible = flattenTree(NODES, expanded);

	const flip = () => {
		if (isTreeFocused) {
			const id = visible[tree.cursor]?.node.id;
			if (id !== undefined) {
				setExpanded(previous => {
					const next = new Set(previous);
					if (!next.delete(id)) {
						next.add(id);
					}

					return next;
				});
			}
		} else {
			setIsDescending(previous => !previous);
		}
	};

	const table = useListNav({
		count: rows.length,
		isActive: isInside && !isTreeFocused,
		onSelect: flip,
	});
	const tree = useListNav({
		count: visible.length,
		isActive: isInside && isTreeFocused,
		onSelect: flip,
	});
	useKeys(
		DATA_BINDINGS,
		{
			switch() {
				setIsTreeFocused(previous => !previous);
			},
			act: flip,
		},
		{isActive: isInside},
	);

	return (
		<>
			<Sample name="Table" note="header, windowed rows, sort glyph (enter)">
				<Table
					columns={FILE_COLUMNS}
					rows={rows}
					cursor={table.cursor}
					height={TABLE_HEIGHT}
					width={Math.min(width, MAX_TABLE)}
					getKey={row => row.name}
					isFocused={isInside && !isTreeFocused}
					sort={{id: 'name', isDescending}}
				/>
			</Sample>
			<Sample name="Tree" note="expandable nodes (enter): JSON as a tree">
				<Tree
					nodes={NODES}
					expanded={expanded}
					cursorId={visible[tree.cursor]?.node.id}
					height={TREE_HEIGHT}
					isFocused={isInside && isTreeFocused}
				/>
			</Sample>
		</>
	);
}
