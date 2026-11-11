/**
Draws one page. `framed` apps (and the menu, whose id is `MENU_ROUTE.id`) get the heavy outer `Frame`
that hugs the terminal: `Menu › App` title in the top edge, key hints (`fitKeyHints` over the bindings
a key can reach now) or the current toast in the bottom edge, and the screen in a body box of exactly
`bodySize` so dialogs can centre in it. Below 40 columns or 13 rows the frame is dropped for a title
line over the body. `bare` apps get the whole terminal and nothing else. Either way the screen sits in
`<InputScope id={app.id}>`, `ScreenSizeProvider` and `AppServiceProvider`, and `overlay` (help, theme
picker) is rendered last in the body so it paints over the screen.
*/
import type {ReactNode} from 'react';
import {Box, useWindowSize} from 'ink';
import {APP} from '../app.config.js';
import {useTheme} from '../theme/context.js';
import {fitKeyHints, InputScope, useActiveBindings} from '../ui/input/index.js';
import {
	Frame,
	KeyHints,
	optionalProp,
	T,
	Toast,
	type ToastTone,
} from '../ui/kit/index.js';
import {truncate} from '../core/format.js';
import {chromeTitle} from './chrome-text.js';
import {AppServiceProvider, ScreenSizeProvider} from './context.js';
import {shellLayout, type ShellLayout} from './screen-size.js';
import {MENU_ROUTE, type AppDefinition, type AppService} from './types.js';

export type AppShellProps = {
	readonly app: AppDefinition;
	readonly service: AppService | undefined;
	/**
	The message to show in the bottom edge in place of the key hints (the shell times it out).
	*/
	readonly toast?: {readonly text: string; readonly tone?: ToastTone};
	/**
	Dialogs and overlays, drawn over the screen. Mount them only while open.
	*/
	readonly overlay?: ReactNode;
};

/**
Columns a toast takes besides its text: the tone glyph and a space.
*/
const TOAST_PREFIX = 2;

type FooterProps = {
	readonly width: number;
	readonly toast: AppShellProps['toast'];
};

/**
The key hints a key can reach right now, or the toast.
*/
function Footer({width, toast}: FooterProps) {
	const {reachable} = useActiveBindings();
	if (width <= 0) {
		return null;
	}

	if (toast !== undefined) {
		const text = truncate(toast.text, Math.max(0, width - TOAST_PREFIX));
		return (
			<Box flexShrink={0}>
				<Toast text={text} {...optionalProp('tone', toast.tone)} />
			</Box>
		);
	}

	return <KeyHints hints={fitKeyHints(reachable, width)} maxWidth={width} />;
}

type ChromeProps = {
	readonly layout: ShellLayout;
	readonly title: string;
	readonly terminal: {readonly columns: number; readonly rows: number};
	readonly toast: AppShellProps['toast'];
	readonly children: ReactNode;
};

function FramedChrome({layout, title, terminal, toast, children}: ChromeProps) {
	return (
		<Frame
			width={terminal.columns}
			height={terminal.rows}
			top={
				<T bold tone="accent">
					{title}
				</T>
			}
			topWidth={[...title].length}
			bottom={<Footer width={layout.footerWidth} toast={toast} />}
		>
			{children}
		</Frame>
	);
}

function MinimalChrome({layout, title, toast, children}: ChromeProps) {
	const hintsWidth = Math.max(0, layout.footerWidth - [...title].length - 2);
	return (
		<>
			<Box flexShrink={0} width={layout.footerWidth}>
				<T bold tone="accent" wrap="truncate-end">
					{title}
				</T>
				{hintsWidth > 0 && (
					<Box marginLeft={2} width={hintsWidth}>
						<Footer width={hintsWidth} toast={toast} />
					</Box>
				)}
			</Box>
			{children}
		</>
	);
}

export function AppShell({app, service, toast, overlay}: AppShellProps) {
	const terminal = useWindowSize();
	const theme = useTheme();
	const {screen: Screen} = app;
	const chrome = app.chrome ?? 'framed';
	const layout = shellLayout(terminal, chrome);
	const bg = optionalProp('backgroundColor', theme.colors.bg);
	const root = {
		flexDirection: 'column',
		width: terminal.columns,
		height: terminal.rows,
		overflow: 'hidden',
	} as const;

	if (layout.isTooSmall) {
		return (
			<Box {...root} {...bg}>
				<T tone="warn" wrap="truncate-end">
					Terminal too small
				</T>
			</Box>
		);
	}

	const body = (
		<AppServiceProvider service={service}>
			<ScreenSizeProvider size={layout.body}>
				<Box
					flexDirection="column"
					width={layout.body.columns}
					height={layout.body.rows}
					overflow="hidden"
				>
					<InputScope id={app.id}>
						<Screen />
					</InputScope>
					{overlay}
				</Box>
			</ScreenSizeProvider>
		</AppServiceProvider>
	);

	if (layout.mode === 'bare') {
		return (
			<Box {...root} {...bg}>
				{body}
			</Box>
		);
	}

	const title = chromeTitle(
		APP.displayName,
		app.id === MENU_ROUTE.id ? undefined : app.title,
		layout.titleWidth,
	);
	const Chrome = layout.mode === 'framed' ? FramedChrome : MinimalChrome;
	return (
		<Box {...root} {...bg}>
			<Chrome layout={layout} title={title} terminal={terminal} toast={toast}>
				{body}
			</Chrome>
		</Box>
	);
}
