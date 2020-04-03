/**
 *
 */
export type Failure<I> = Readonly<{type: 'failure', reason: string, value: I}>
export type Success<O> = Readonly<{type: 'success', value: O}>
export type Result<I,O> = Failure<I> | Success<O>
export type Parser<I,O> = (value: I) => Result<I,O>;

export type SuccessType<T> = T extends Result<any, infer U> ? Success<U> : never;
export type FailureType<T> = T extends Result<infer U, any> ? Failure<U> : never;

export type ResultType<T> = T extends Parser<infer I, infer O> ? Result<I, O> : never;
export type ParserType<T> = T extends Parser<any, infer U> ? U : never;

export function optional<I,O>(validator: Parser<I,O>): Parser<I,(null|O)> {
    return (value) => value === null ? success(null) : validator(value);
}

export function voidable<I,O>(validator: Parser<I,O>): Parser<I, (undefined|O)> {
    return (value) => value === undefined ? success(undefined) : validator(value);
}

export function parseString<I>(value: I): Result<I,string> {
    return typeof value === 'string' ? success(value) : failTypeOf(value);
}

export function parseNumber<I>(value: I): Result<I,number> {
    return typeof(value) === 'number' ? success(value) : failTypeOf(value);
}

export function parseUndefined<I>(value: I): Result<I,undefined> {
    return value === undefined ? success(undefined) : failTypeOf(value);
}

export function parseBoolean<I>(value: I): Result<I,boolean> {
    return typeof(value) === 'boolean' ? success(value) : failTypeOf(value);
}

export function parseAnyValue<I>(value: I): Success<any> {
    return success(value);
}

export function parseObject<I>(value: I): Result<I, Object> {
    return typeof(value) === 'object' && value !== null ? success(value) : failTypeOf(value);
}

export function parseArray<I,O>(value: I): Result<I,O[]> {
    return Array.isArray(value) ? success(value) : failure(value, 'value is not Array.isArray');
}

export function parseObjectOf<I, T extends {}>(validators: {[K in keyof T]: Parser<I, T[K]>}): Parser<I,T> {
    return function(value: any) {
        let result = {} as T;
        for (const key in validators) {
            const validated = validators[key](value ? value[key] : undefined);
            if (isFailure(validated)) {
                return keyedFailure(value, key, validated);
            }
            result[key] = validated.value
        }
        return success(result);
    };
}

export function parseIndexedObjectOf<I, T>(parser: Parser<any,T>): Parser<I,{[key: string]: T}> {
    return function(value) {
        let result = {} as {[key: string]: T};
        if (value === null || value == undefined) {
            return failure(value, 'value is null or undefined');
        }
        if (typeof value !== 'object') {
            return failTypeOf(value);
        }
        for (const key in value) {
            const child = parser(value[key]);
            if (isFailure(child)) {
                return keyedFailure(value, key, child);
            }
            result[key] = child.value;
        }
        return success(result);
    }
}

export function mapParser<I, A, B>(validator: Parser<I, A>, next: (value: A) => Result<I, B>): Parser<I, B> {
    return (value) => mapFailure(
        mapSuccess(validator(value), next),
        failure => ({...failure, value}),
    );
}

export function mapFailure<I, A, B>(result: Result<I, A>, next: (failure: Failure<I>) => B): (B | Success<A>) {
    return isFailure(result) ? next(result) : result;
}

export function mapSuccess<I, A, B>(result: Result<I, A>, next: (value: A) => B): (B | Failure<I>) {
    return isSuccess(result) ? next(result.value) : result;
}

export function mapResult<I, A, B, C>(result: Result<I, A>, success:(value: A) => B, failure:(failure: Failure<I>) => C): (B|C) {
    return isSuccess(result) ? success(result.value) : failure(result);
}

export function parseArrayOf<I, O>(validator: Parser<I,O>): Parser<I,O[]> {
    return mapParser(parseArray, (value: any[]) =>
        value.reduce<Result<I,O[]>>(
            (result, member, index) => mapSuccess(
                result,
                items => mapResult(
                    validator(member),
                    valid => success(items.concat([valid])),
                    failure => keyedFailure(value, index, failure)
                )
            ),
            success([])
        )
    )
}

export function parseOneOf<I, O, V extends Array<Parser<any, any>>>(parser: Parser<I, O>, ...parsers: V): Parser<I, (ParserType<V[number]>|O)> {
    if (parsers.length === 0) {
        return parser;
    }
    return value => mapFailure(
        parsers.reduce(
            (result, validator) => mapFailure(result, () => validator(value)),
            parser(value)
        ),
        () => failure(value, `'${value}' did not match any of ${parsers.length+1} validators`)
    );
}

export function parseExactly<S extends (string|number|boolean)>(option: S): Parser<any, S> {
    return (value: any) => value === option ? success(option) : failure(value, `is not ${option}`);
}

export function success<T>(value: T): Success<T> {
    return {
        value,
        type: 'success'
    }
}

export function failure<T>(value: T, reason: string): Failure<T> {
    return {
        type: 'failure',
        value,
        reason,
    }
}

function failTypeOf<T>(value: T): Failure<T> {
    return failure(value, 'typeof value is ' + (typeof value));
}

function keyedFailure<T>(value: any, key: string | number, failure: Failure<T>): Failure<T> {
    return {
        ...failure,
        value,
        reason: `Failed at '${key}': ${failure.reason}`,
    }
}

export function isSuccess<I,O>(result: Result<I,O>): result is Success<O> {
    return result.type === 'success';
}

export function isFailure<I,O>(result: Result<I,O>): result is Failure<I> {
    return result.type === 'failure';
}
