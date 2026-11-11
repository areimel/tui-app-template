/**
A value or an error, for operations that can fail in expected ways (I/O, parsing, validation).
Pure. Throw only for programmer errors; return a `Result` for everything a user or the OS can cause.
*/

export type Result<T, E = string> =
	| {readonly isOk: true; readonly value: T}
	| {readonly isOk: false; readonly error: E};

/**
A successful result. Assignable to any `Result<T, E>`.
*/
export function ok<T>(value: T): Result<T, never> {
	return {isOk: true, value};
}

/**
A failed result. Assignable to any `Result<T, E>`.
*/
export function fail<E>(error: E): Result<never, E> {
	return {isOk: false, error};
}
