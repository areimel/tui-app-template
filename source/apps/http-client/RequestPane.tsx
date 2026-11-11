/**
The Request pane: the generic `Form` over the request fields.
*/
import {useMemo} from 'react';
import {Box} from 'ink';
import {fail, ok} from '../../core/result.js';
import {HTTP_METHODS} from '../../platform/types.js';
import {Form, type FormField} from '../../ui/form/index.js';
import {Panel, T} from '../../ui/kit/index.js';
import {innerSize, type PaneSize} from './layout.js';
import {
	parseHeader,
	parseUrl,
	hasBodyMethod,
	type RequestForm,
} from './request-model.js';

const LABEL_WIDTH = 6;
/**
Marker column, label column gap and the `[ ` / ` ]` of the value box.
*/
const ROW_OVERHEAD = 2 + 1 + 4;

function clip(text: string, max: number): string {
	const characters = [...text];
	return characters.length <= max
		? text
		: `${characters.slice(0, Math.max(1, max - 1)).join('')}…`;
}

type Field = FormField<RequestForm, undefined>;

/**
The form fields; displayed values are clipped to `maxValue` cells so every row stays one line.
*/
export function requestFields(maxValue: number): readonly Field[] {
	const base = {
		isVisible: () => true,
		disabledReason: () => undefined,
	};
	return [
		{
			...base,
			id: 'method',
			label: 'Method',
			kind: 'choice',
			display: value => value.method,
			cycle(value, direction) {
				const index = HTTP_METHODS.indexOf(value.method) + direction;
				const next =
					HTTP_METHODS[(index + HTTP_METHODS.length) % HTTP_METHODS.length];
				return next === undefined ? {} : {method: next};
			},
		},
		{
			...base,
			id: 'url',
			label: 'URL',
			kind: 'text',
			display: value =>
				clip(value.url === '' ? '(enter a URL)' : value.url, maxValue),
			editText: value => value.url,
			parse(text) {
				const url = parseUrl(text);
				return url.isOk ? ok({url: url.value}) : fail(url.error);
			},
		},
		{
			...base,
			id: 'header',
			label: 'Header',
			kind: 'text',
			display: value =>
				clip(value.header === '' ? '(none)' : value.header, maxValue),
			editText: value => value.header,
			parse(text) {
				const header = parseHeader(text);
				return header.isOk ? ok({header: text.trim()}) : fail(header.error);
			},
		},
		{
			...base,
			id: 'body',
			label: 'Body',
			kind: 'text',
			isVisible: value => hasBodyMethod(value.method),
			display: value =>
				clip(value.body === '' ? '(empty)' : value.body, maxValue),
			editText: value => value.body,
			parse: text => ok({body: text}),
		},
	];
}

export type RequestPaneProps = {
	readonly form: RequestForm;
	readonly size: PaneSize;
	readonly isFocused: boolean;
	readonly onChange: (patch: Partial<RequestForm>) => void;
};

export function RequestPane({
	form,
	size,
	isFocused,
	onChange,
}: RequestPaneProps) {
	const inner = innerSize(size);
	const maxValue = Math.max(4, inner.width - LABEL_WIDTH - ROW_OVERHEAD);
	const fields = useMemo(() => requestFields(maxValue), [maxValue]);
	const fieldCount = hasBodyMethod(form.method) ? 4 : 3;
	return (
		<Panel
			title="Request"
			isFocused={isFocused}
			width={size.width}
			height={size.height}
		>
			<Form
				fields={fields}
				value={form}
				context={undefined}
				isActive={isFocused}
				labelWidth={LABEL_WIDTH}
				onChange={onChange}
			/>
			{inner.height > fieldCount + 1 && inner.width >= 36 ? (
				<Box marginTop={1} flexDirection="column">
					<T tone="muted" wrap="truncate-end">
						Enter edits · ←/→ method
					</T>
				</Box>
			) : null}
		</Panel>
	);
}
