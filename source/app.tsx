import {useEffect, useMemo, useRef, useState} from 'react';
import type {ConfigTracker} from './config/merge.js';
import {isActivePhase, isTerminalPhase} from './core/session/selectors.js';
import type {SessionController} from './core/session/types.js';
import {CupPanel} from './features/cup/CupPanel.js';
import {HelpOverlay} from './features/help/HelpOverlay.js';
import {OptionsEditor} from './features/options/OptionsEditor.js';
import {buildStats} from './features/stats/stats-model.js';
import {StatsPanel} from './features/stats/StatsPanel.js';
import {SessionStatus} from './features/status/SessionStatus.js';
import {StatusLine} from './features/status/StatusLine.js';
import {ThemePicker} from './features/themes/ThemePicker.js';
import {DashboardLayout} from './layouts/DashboardLayout.js';
import {Hints, Warnings, type Overlay} from './layouts/Footer.js';
import {hintsWidth} from './layouts/frame-plan.js';
import {OPTION_LABEL_WIDTH, trimStats} from './layouts/region-heights.js';
import {planWithWarnings} from './layouts/plan-for-state.js';
import type {SystemStats} from './platform/system-stats.js';
import type {Capabilities} from './platform/types.js';
import {summarize, type ExitOutcome} from './summary.js';
import {ThemeProvider, useTheme} from './theme/context.js';
import {resolveByName} from './theme/resolve.js';
import type {ColorLevel} from './theme/tokens.js';
import {ALL_KEY_BINDINGS, useKeymap} from './ui/hooks/use-keymap.js';
import {useLayout, type TerminalSize} from './ui/hooks/use-layout.js';
import {useSession} from './ui/hooks/use-session.js';
import {useStats} from './ui/hooks/use-stats.js';
import {Panel} from './ui/kit/index.js';
import {
	useSettings,
	type Settings,
	type SettingsSaver,
} from './use-settings.js';

export type AppProps = {
	readonly controller: SessionController;
	/**
	From `adapter.detect()`; disables options the machine cannot honour.
	*/
	readonly capabilities: Capabilities | undefined;
	readonly tracker: ConfigTracker;
	readonly saver: SettingsSaver;
	readonly colorLevel: ColorLevel;
	/**
	Config-load warnings, shown on the frame's last rows above the key hints.
	*/
	readonly warnings?: readonly string[];
	/**
	Terminal size override (tests); defaults to the real window size.
	*/
	readonly size?: TerminalSize;
	readonly isPidAlive: (pid: number) => boolean;
	readonly readStats?: () => SystemStats;
	readonly now?: () => number;
	/**
	Called once when the session reaches a terminal phase, after the config is flushed.
	*/
	readonly onExit: (outcome: ExitOutcome) => void;
};

type DashboardProps = AppProps & {readonly settings: Settings};

const NO_WARNINGS: readonly string[] = [];

function Dashboard({
	controller,
	capabilities,
	saver,
	warnings = NO_WARNINGS,
	size,
	isPidAlive,
	readStats,
	now: clock,
	onExit,
	settings,
}: DashboardProps) {
	const theme = useTheme();
	const state = useSession(controller);
	const isOver = isTerminalPhase(state.phase);
	const {stats, now} = useStats({
		isActive: !isOver,
		...(readStats !== undefined && {readStats}),
		...(clock !== undefined && {now: clock}),
	});
	const layout = useLayout(size);
	const [overlay, setOverlay] = useState<Overlay>();
	const [isEditing, setIsEditing] = useState(false);
	const exitedRef = useRef(false);

	useEffect(() => {
		if (!isOver || exitedRef.current) {
			return;
		}

		exitedRef.current = true;
		const finish = () => {
			onExit(summarize(state));
		};

		void saver
			.flush()
			.catch(() => undefined)
			.then(finish);
	}, [isOver, state, saver, onExit]);

	useKeymap({
		isEnabled: !isEditing && overlay === undefined && !isOver,
		onQuit() {
			void controller.stop('user');
		},
		onTogglePause() {
			const {phase} = controller.getState();
			if (isActivePhase(phase)) {
				void controller.pause();
			} else if (phase === 'paused') {
				void controller.resume();
			}
		},
		onToggleThemes() {
			setOverlay('themes');
		},
		onToggleAnimation: settings.toggleAnimation,
		onToggleHelp() {
			setOverlay('help');
		},
		onCycleTheme: settings.cycleTheme,
	});

	const lines = buildStats({system: stats, battery: state.battery, state, now});
	const context = {capabilities, battery: state.battery, isPidAlive};
	const {plan, warnings: shownWarnings} = planWithWarnings({
		layout,
		state,
		now,
		lines,
		context,
		overlay,
		warnings,
	});
	const besideGrow = plan.stats === 'beside' ? {flexGrow: 1} : {};
	const closeOverlay = () => {
		setOverlay(undefined);
	};

	const overlayNode =
		overlay === 'themes' ? (
			<ThemePicker
				isActive
				flexGrow={1}
				current={settings.shownTheme}
				onPreview={settings.previewTheme}
				onSelect={name => {
					settings.selectTheme(name);
					closeOverlay();
				}}
				onCancel={() => {
					settings.cancelPreview();
					closeOverlay();
				}}
			/>
		) : overlay === 'help' ? (
			<HelpOverlay
				isActive
				flexGrow={1}
				bindings={ALL_KEY_BINDINGS}
				onClose={closeOverlay}
			/>
		) : undefined;

	return (
		<DashboardLayout
			layout={layout}
			plan={plan}
			cup={
				<CupPanel
					isAnimated={settings.isAnimated}
					isHot={isActivePhase(state.phase)}
					showCredits={plan.showCredits}
					flexGrow={1}
				/>
			}
			session={
				<Panel title="Session" {...besideGrow}>
					<SessionStatus state={state} now={now} />
				</Panel>
			}
			statusLine={<StatusLine state={state} now={now} />}
			stats={
				<Panel title="Stats" {...besideGrow}>
					<StatsPanel lines={trimStats(lines, plan.statsLineCount)} />
				</Panel>
			}
			options={
				<Panel flexGrow={1} isFocused={overlay === undefined} title="Options">
					<OptionsEditor
						options={state.options}
						capabilities={capabilities}
						battery={state.battery}
						isActive={overlay === undefined && !isOver}
						isPidAlive={isPidAlive}
						labelWidth={OPTION_LABEL_WIDTH}
						onEditingChange={setIsEditing}
						onChange={patch => {
							settings.saveOptions(patch, controller.getState().options);
							void controller.updateOptions(patch);
						}}
					/>
				</Panel>
			}
			{...(overlayNode === undefined ? {} : {overlay: overlayNode})}
			hints={
				<Hints
					width={hintsWidth(plan, layout)}
					overlay={overlay}
					isEditing={isEditing}
					isPaused={state.phase === 'paused'}
				/>
			}
			warnings={<Warnings warnings={shownWarnings} />}
			{...(theme.colors.bg === undefined
				? {}
				: {backgroundColor: theme.colors.bg})}
		/>
	);
}

/**
Root component: theme provider around the dashboard. Every collaborator is injected so tests need no OS access.
*/
export default function App(props: AppProps) {
	const settings = useSettings(props.tracker, props.saver);
	const theme = useMemo(
		() => resolveByName(settings.shownTheme, props.colorLevel),
		[settings.shownTheme, props.colorLevel],
	);
	return (
		<ThemeProvider theme={theme}>
			<Dashboard {...props} settings={settings} />
		</ThemeProvider>
	);
}
