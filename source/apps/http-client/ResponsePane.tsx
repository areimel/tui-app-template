/**
The Response pane: idle hint, loading spinner, error, or the finished `ResponseView`.
*/
import {Box} from 'ink';
import type {HttpError, HttpResponse} from '../../platform/types.js';
import {Badge, Panel, Spinner, T} from '../../ui/kit/index.js';
import {innerSize, type PaneSize} from './layout.js';
import {ResponseView} from './ResponseView.js';
import {formatWaiting} from './response-model.js';

/**
What the pane shows. `problem` is a form error that blocked sending.
*/
export type ResponseContent =
	| {readonly kind: 'idle'}
	| {readonly kind: 'problem'; readonly message: string}
	| {
			readonly kind: 'loading';
			readonly label: string;
			readonly elapsedMs: number;
	  }
	| {readonly kind: 'failed'; readonly error: HttpError}
	| {readonly kind: 'done'; readonly response: HttpResponse};

export type ResponsePaneProps = {
	readonly content: ResponseContent;
	readonly size: PaneSize;
	readonly isFocused: boolean;
	/**
	Changes with every send, so a new response resets its tab, tree and scroll.
	*/
	readonly sequence: number;
};

const ERROR_LABELS: Record<HttpError['kind'], string> = {
	network: 'Network error',
	timeout: 'Timed out',
	aborted: 'Cancelled',
	'invalid-url': 'Invalid URL',
};

function Message({content}: {readonly content: ResponseContent}) {
	switch (content.kind) {
		case 'loading': {
			return (
				<Box flexDirection="column">
					<Spinner
						label={`${content.label} ${formatWaiting(content.elapsedMs)}`}
					/>
					<T tone="muted" wrap="truncate-end">
						x or esc cancels the request
					</T>
				</Box>
			);
		}

		case 'failed': {
			return (
				<Box flexDirection="column">
					<Badge state="err" label={ERROR_LABELS[content.error.kind]} />
					<T wrap="truncate-end">{content.error.message}</T>
					<T tone="muted" wrap="truncate-end">
						s sends again
					</T>
				</Box>
			);
		}

		case 'problem': {
			return (
				<Box flexDirection="column">
					<Badge state="warn" label="Not sent" />
					<T wrap="truncate-end">{content.message}</T>
					<T tone="muted" wrap="truncate-end">
						Fix the Request pane, then press s
					</T>
				</Box>
			);
		}

		case 'idle':
		case 'done': {
			return (
				<Box flexDirection="column">
					<T tone="muted" wrap="truncate-end">
						No response yet.
					</T>
					<T wrap="truncate-end">Press s (or Enter here) to send.</T>
				</Box>
			);
		}
	}
}

export function ResponsePane({
	content,
	size,
	isFocused,
	sequence,
}: ResponsePaneProps) {
	const inner = innerSize(size);
	return (
		<Panel
			title="Response"
			isFocused={isFocused}
			width={size.width}
			height={size.height}
		>
			{content.kind === 'done' ? (
				<ResponseView
					key={sequence}
					response={content.response}
					width={inner.width}
					height={inner.height}
					isActive={isFocused}
				/>
			) : (
				<Message content={content} />
			)}
		</Panel>
	);
}
