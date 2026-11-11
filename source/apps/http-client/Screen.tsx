/**
The HTTP Client page: a Request form and a Response viewer. Sending is async (`useAsync`) and
cancellable; history and the last request persist in the app config.
*/
import {useLayoutEffect, useRef, useState} from 'react';
import {Box} from 'ink';
import type {HttpError, HttpResponse} from '../../platform/types.js';
import {
	useAppConfig,
	useScreenSize,
	useServices,
	useToast,
} from '../../shell/context.js';
import {useAsync, usePoll} from '../../ui/hooks/index.js';
import type {AsyncState} from '../../ui/hooks/types.js';
import {useKeys} from '../../ui/input/index.js';
import {
	CANCEL_BINDINGS,
	MAIN_BINDINGS,
	SEND_HERE_BINDINGS,
} from './bindings.js';
import {HTTP_CONFIG} from './config.js';
import {HistoryDialog} from './HistoryDialog.js';
import {planLayout} from './layout.js';
import {RequestPane} from './RequestPane.js';
import {
	buildRequest,
	formFromEntry,
	pushHistory,
	scrubForSave,
	hasBodyMethod,
	type RequestForm,
} from './request-model.js';
import {ResponsePane, type ResponseContent} from './ResponsePane.js';

const APP_ID = 'http-client';
const DIALOG_WIDTH = 64;

type Pane = 'request' | 'response';

function hostOf(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

function contentFor(
	problem: string | undefined,
	state: AsyncState<HttpResponse, HttpError>,
	waiting: {readonly label: string; readonly elapsedMs: number},
): ResponseContent {
	if (problem !== undefined) {
		return {kind: 'problem', message: problem};
	}

	switch (state.status) {
		case 'loading': {
			return {kind: 'loading', ...waiting};
		}

		case 'failed': {
			return {kind: 'failed', error: state.error};
		}

		case 'done': {
			return {kind: 'done', response: state.value};
		}

		case 'idle': {
			return {kind: 'idle'};
		}
	}
}

export function Screen() {
	const {columns, rows} = useScreenSize();
	const services = useServices();
	const toast = useToast();
	const [config, updateConfig] = useAppConfig(APP_ID, HTTP_CONFIG);
	const [form, setForm] = useState<RequestForm>(config.last);
	const [pane, setPane] = useState<Pane>('request');
	const [problem, setProblem] = useState<string | undefined>();
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [sequence, setSequence] = useState(0);
	const [startedAt, setStartedAt] = useState(0);
	const historyRef = useRef(config.history);
	useLayoutEffect(() => {
		historyRef.current = config.history;
	});

	const request = useAsync<
		HttpResponse,
		HttpError,
		[Parameters<typeof services.http.send>[0], RequestForm]
	>(async (signal, httpRequest, sent) => {
		const result = await services.http.send(httpRequest, signal);
		if (!signal.aborted) {
			updateConfig({
				history: pushHistory(historyRef.current, {
					...scrubForSave(sent),
					status: result.isOk ? result.value.status : undefined,
				}),
			});
		}

		return result;
	});

	const isLoading = request.state.status === 'loading';
	const now = usePoll(() => services.now(), {
		intervalMs: 200,
		isActive: isLoading,
	});

	const send = () => {
		const built = buildRequest(form);
		if (!built.isOk) {
			setProblem(built.error);
			return;
		}

		setProblem(undefined);
		setStartedAt(services.now());
		setSequence(value => value + 1);
		updateConfig({last: scrubForSave(form)});
		request.start(built.value, form);
	};

	const cancel = () => {
		request.cancel();
		toast('Request cancelled', 'warn');
	};

	useKeys(
		MAIN_BINDINGS,
		{
			send,
			switchPane() {
				setPane(value => (value === 'request' ? 'response' : 'request'));
			},
			history() {
				setIsHistoryOpen(true);
			},
		},
		{isActive: !isHistoryOpen},
	);
	useKeys(CANCEL_BINDINGS, {cancel}, {isActive: isLoading});
	useKeys(
		SEND_HERE_BINDINGS,
		{send},
		{
			isActive:
				pane === 'response' && request.state.status !== 'done' && !isLoading,
		},
	);

	const layout = planLayout(columns, rows, hasBodyMethod(form.method) ? 4 : 3);
	const isRequestShown = layout.mode !== 'single' || pane === 'request';
	const isResponseShown = layout.mode !== 'single' || pane === 'response';

	const content = contentFor(problem, request.state, {
		label: `Sending ${form.method} ${hostOf(form.url)}…`,
		elapsedMs: now - startedAt,
	});

	return (
		<Box
			width={columns}
			height={rows}
			flexDirection={layout.mode === 'side' ? 'row' : 'column'}
		>
			{isRequestShown ? (
				<RequestPane
					form={form}
					size={layout.request}
					isFocused={pane === 'request'}
					onChange={patch => {
						setForm(value => ({...value, ...patch}));
						setProblem(undefined);
					}}
				/>
			) : null}
			{isResponseShown ? (
				<ResponsePane
					content={content}
					size={layout.response}
					isFocused={pane === 'response'}
					sequence={sequence}
				/>
			) : null}
			{isHistoryOpen ? (
				<HistoryDialog
					entries={config.history}
					width={Math.min(DIALOG_WIDTH, columns - 2)}
					onLoad={entry => {
						setForm(formFromEntry(entry));
						setProblem(undefined);
						setPane('request');
						setIsHistoryOpen(false);
					}}
					onClose={() => {
						setIsHistoryOpen(false);
					}}
				/>
			) : null}
		</Box>
	);
}
