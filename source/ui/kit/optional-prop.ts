/**
Builds `{key: value}`, or `{}` when `value` is `undefined`, for spreading into props.
Needed because `exactOptionalPropertyTypes` and Ink both reject explicit `undefined`.
*/
export function optionalProp<K extends string, V>(
	key: K,
	value: V | undefined,
): Partial<Record<K, V>> {
	return (value === undefined ? {} : {[key]: value}) as Partial<Record<K, V>>;
}
