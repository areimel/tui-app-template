/**
The Request pane: the generic `Form` over the request fields.
*/
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

type Field = FormField<RequestForm, undefined>;

const base = {
	isVisible: () => true,
	disabledReason: () => undefined,
};

/**
The form fields (`Form` clips long values to the pane, so every row stays one line).
*/
export const REQUEST_FIELDS: readonly Field[] = [
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
		display: value => (value.url === '' ? '(enter a URL)' : value.url),
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
		display: value => (value.header === '' ? '(none)' : value.header),
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
		display: value => (value.body === '' ? '(empty)' : value.body),
		editText: value => value.body,
		parse: text => ok({body: text}),
	},
];

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
	const fieldCount = hasBodyMethod(form.method) ? 4 : 3;
	return (
		<Panel
			title="Request"
			isFocused={isFocused}
			width={size.width}
			height={size.height}
		>
			<Form
				fields={REQUEST_FIELDS}
				value={form}
				context={undefined}
				isActive={isFocused}
				labelWidth={LABEL_WIDTH}
				width={inner.width}
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
