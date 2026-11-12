/**
The Keep Awake page: the original dashboard (frame, heading art, cup, Session / Stats panels and the
options form, arranged by the layout planner) over the app's service. The session lives in the service,
so leaving this page changes nothing; a stop condition shows the stopped state here and `r` starts a
new session. Theme, animation, help and the theme picker come from the shell.
*/
import {useCallback} from 'react';
import {
	useAppConfig,
	useAppService,
	useServices,
	useSettings,
} from '../../shell/context.js';
import {useTheme} from '../../theme/context.js';
import {useExternalStore} from '../../ui/hooks/use-external-store.js';
import {useKeys} from '../../ui/input/index.js';
import {Panel} from '../../ui/kit/index.js';
import {sessionBindings} from './bindings.js';
import {KEEP_AWAKE_CONFIG, toConfigPatch, APP_ID} from './config.js';
import {CupPanel} from './features/cup/CupPanel.js';
import {OptionsEditor} from './features/options/OptionsEditor.js';
import {buildStats} from './features/stats/stats-model.js';
import {StatsPanel} from './features/stats/StatsPanel.js';
import {SessionStatus} from './features/status/SessionStatus.js';
import {StatusLine} from './features/status/StatusLine.js';
import {useLayout} from './hooks/use-layout.js';
import {useSession} from './hooks/use-session.js';
import {useStats} from './hooks/use-stats.js';
import {DashboardLayout} from './layouts/DashboardLayout.js';
import {Hints} from './layouts/Footer.js';
import {hintsWidth} from './layouts/frame-plan.js';
import {planForState} from './layouts/plan-for-state.js';
import {OPTION_LABEL_WIDTH, trimStats} from './layouts/region-heights.js';
import {isActivePhase, isTerminalPhase} from './session/selectors.js';
import type {KeepAwakeService} from './service.js';

export function Screen() {
	const service = useAppService<KeepAwakeService>();
	const services = useServices();
	const settings = useSettings();
	const theme = useTheme();
	const [, saveConfig] = useAppConfig(APP_ID, KEEP_AWAKE_CONFIG);
	const state = useSession(service);
	const capabilities = useExternalStore(service.capabilities);
	const isOver = isTerminalPhase(state.phase);
	const readStats = useCallback(() => {
		const {uptimeSeconds, loadAverage, hostname} =
			services.system.readSnapshot();
		return {uptimeSeconds, loadAverage, hostname};
	}, [services]);
	const {stats, now} = useStats({
		isActive: !isOver,
		readStats,
		now: services.now,
	});
	const layout = useLayout();

	useKeys(sessionBindings(state.phase), {
		togglePause() {
			const {phase} = service.getState();
			if (isActivePhase(phase)) {
				void service.pause();
			} else if (phase === 'paused') {
				void service.resume();
			}
		},
		restart() {
			void service.restart();
		},
		toggleAnimation: settings.toggleAnimation,
	});

	const lines = buildStats({system: stats, battery: state.battery, state, now});
	const context = {
		capabilities,
		battery: state.battery,
		isPidAlive: service.isPidAlive,
	};
	const plan = planForState({layout, state, now, lines, context});
	const besideGrow = plan.stats === 'beside' ? {flexGrow: 1} : {};

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
				<Panel flexGrow={1} isFocused={!isOver} title="Options">
					<OptionsEditor
						options={state.options}
						capabilities={capabilities}
						battery={state.battery}
						isActive={!isOver}
						isPidAlive={service.isPidAlive}
						labelWidth={OPTION_LABEL_WIDTH}
						onChange={patch => {
							const saved = toConfigPatch(patch, service.getState().options);
							if (saved !== undefined) {
								saveConfig(saved);
							}

							void service.updateOptions(patch);
						}}
					/>
				</Panel>
			}
			hints={<Hints width={hintsWidth(plan, layout)} />}
			{...(theme.colors.bg === undefined
				? {}
				: {backgroundColor: theme.colors.bg})}
		/>
	);
}
