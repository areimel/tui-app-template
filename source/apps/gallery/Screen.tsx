/**
The Component Gallery: a tab per kit category. This file only hosts the tabs, their keys and scrolling;
each sample lives in `tabs/`.
*/
import {useRef, useState} from 'react';
import {Box, useBoxMetrics, type DOMElement} from 'ink';
import {useSettings, useScreenSize, useToast} from '../../shell/context.js';
import {THEME_NAMES} from '../../theme/tokens.js';
import {useScroll} from '../../ui/hooks/index.js';
import {useKeys} from '../../ui/input/index.js';
import {ScrollView, StatusBar, T, Tabs} from '../../ui/kit/index.js';
import {
	ENTER_BINDINGS,
	LEAVE_BINDINGS,
	TAB_BINDINGS,
	THEME_BINDINGS,
} from './bindings.js';
import {DemoDialogs} from './DemoDialogs.js';
import {GALLERY_TABS, type DialogKind} from './tabs/index.js';
import {visibleTabRange} from './tabs-window.js';

const TAB_ROW = 1;
const STATUS_ROW = 1;
const ARROW_COLUMNS = 2;

export function Screen() {
	const {columns, rows} = useScreenSize();
	const settings = useSettings();
	const toast = useToast();
	const [index, setIndex] = useState(0);
	const [isInside, setIsInside] = useState(false);
	const [dialog, setDialog] = useState<DialogKind | undefined>();
	const contentRef = useRef<DOMElement>(null);
	const {height: contentRows} = useBoxMetrics(contentRef);

	const tab = GALLERY_TABS[index] ?? GALLERY_TABS[0];
	const viewport = Math.max(1, rows - TAB_ROW - STATUS_ROW);
	const scroll = useScroll({
		contentRows,
		viewportRows: viewport,
		isActive: !isInside,
	});

	const goTo = (next: number) => {
		setIndex((next + GALLERY_TABS.length) % GALLERY_TABS.length);
		setIsInside(false);
		scroll.scrollTo(0);
	};

	const cycleTheme = (step: number) => {
		const at = THEME_NAMES.indexOf(settings.theme);
		const next =
			THEME_NAMES[(at + step + THEME_NAMES.length) % THEME_NAMES.length];
		if (next !== undefined) {
			settings.selectTheme(next);
		}
	};

	useKeys(
		TAB_BINDINGS,
		{
			previousTab() {
				goTo(index - 1);
			},
			nextTab() {
				goTo(index + 1);
			},
		},
		{isActive: !isInside},
	);
	useKeys(THEME_BINDINGS, {
		previousTheme() {
			cycleTheme(-1);
		},
		nextTheme() {
			cycleTheme(1);
		},
	});
	useKeys(
		ENTER_BINDINGS,
		{
			enter() {
				setIsInside(true);
			},
		},
		{isActive: !isInside && tab?.isInteractive === true},
	);
	useKeys(
		LEAVE_BINDINGS,
		{
			leave() {
				setIsInside(false);
			},
		},
		{isActive: isInside},
	);

	if (tab === undefined) {
		return undefined;
	}

	const contentWidth = Math.max(1, columns - 1);
	const range = visibleTabRange(
		GALLERY_TABS.map(item => item.label),
		index,
		columns - ARROW_COLUMNS,
	);
	const {content: Content} = tab;
	const status = isInside
		? `${tab.label}: esc leaves the sample`
		: `${tab.label} ${index + 1}/${GALLERY_TABS.length}${tab.isInteractive ? ' (enter to try)' : ''}`;

	return (
		<Box flexDirection="column" width={columns} height={rows}>
			<Box width={columns}>
				<T tone="muted">{range.start > 0 ? '‹' : ' '}</T>
				<Tabs
					tabs={GALLERY_TABS.slice(range.start, range.end)}
					value={tab.value}
					isFocused={!isInside}
				/>
				<T tone="muted">{range.end < GALLERY_TABS.length ? '›' : ' '}</T>
			</Box>
			<ScrollView
				hasScrollbar
				height={viewport}
				offset={scroll.offset}
				contentRows={contentRows}
				width={columns}
			>
				<Box
					ref={contentRef}
					flexDirection="column"
					width={contentWidth}
					flexShrink={0}
				>
					<Content
						width={contentWidth}
						isInside={isInside}
						openDialog={setDialog}
					/>
				</Box>
			</ScrollView>
			<StatusBar left={status} right={settings.theme} width={columns} />
			{dialog === undefined ? null : (
				<DemoDialogs
					kind={dialog}
					width={columns}
					onResult={(text, tone) => {
						setDialog(undefined);
						toast(text, tone);
					}}
				/>
			)}
		</Box>
	);
}
