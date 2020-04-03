/**
 * A parser is a function that takes an Input and produces a Result that
 * indicates success or failure.
 *
 * The success wraps the parsed value, the failure provides the reason the
 * value was not able to be parsed.
 */

/**
 * Failure<I> represests a value that could not be parsed. `reason` is the
 * human-readable reason parsing failed, `value` is the original value that
 * could not be parsed.
 */
export type Failure<I> = Readonly<{type: 'failure', reason: string, value: I}>

/**
 * Success<O> represents a valaue that was parsed. `value` is the parsed value.
 */
export type Success<O> = Readonly<{type: 'success', value: O}>

/**
 * Result<I,O> is the return value of Parser<I,O>, either a successful result
 * with th parsed value, or a failure with the reason parsing failed.
 */
export type Result<I,O> = Failure<I> | Success<O>

/**
 * Parser<I,O> is a function that receives an I and returns a Result<I,O>.
 */
export type Parser<I,O> = (value: I) => Result<I,O>;

/**
 * Convenience types for inferring types being parsed.
 */
export type SuccessType<T> = T extends Result<any, infer U> ? Success<U> : never;
export type FailureType<T> = T extends Result<infer U, any> ? Failure<U> : never;

export type ResultType<T> = T extends Parser<infer I, infer O> ? Result<I, O> : never;

/**
 * Given a Parser<I,O>, ParserType<T> will infer the type of the Success result.
 *
 *    const parsePerson = parseObjectOf({
 *       name: parseString,
 *    });
 *
 *    type Person = ParserType<typeof parsePerson>;
 *
 *    const person: Person = {
 *       name: 'Ellen Ripley',
 *    }
 *
 *    const invalid: Person = {
 *        name: 5,
 *    }
 */
export type ParserType<T> = T extends Parser<any, infer U> ? U : never;

/**
 * Given any Parser<I,T>, allows a `null` value as a successful result.
 *
 *     const parseOptionalString = optional(parseString);
 *
 *     isSuccess(parseOptionalString('hello')); // true
 *     isSuccess(parseOptionalString(null)); // true
 *     isSuccess(parseOptionalString(5)); // false
 *
 */
export function optional<I,O>(parser: Parser<I,O>): Parser<I,(null|O)> {
    return (value) => value === null ? success(null) : parser(value);
}

/**
 * Given any Parser<I,T> returns a Parser<I,undefined|T> to allow undefined as
 * as successful type.
 *
 *     const parse = voidable(parseNumber);
 *
 *     isSuccess(parse(1)); // true
 *     isSuccess(parse('1')); // false
 *     isSuccess(parse(undefined)); // true
 *
 */
export function voidable<I,O>(parser: Parser<I,O>): Parser<I, (undefined|O)> {
    return (value) => value === undefined ? success(undefined) : parser(value);
}

/**
 * Given any value input produces a parsed string or a failure. Uses
 * `typeof value === 'string'`:
 *
 *    const result = parseString('a');
 *    if (isSuccess(result)) {
 *         const value: string = result.value;
 *    } else {
 *         throw new Error(result.reason);
 *    }
 *
 */
export function parseString<I>(value: I): Result<I,string> {
    return typeof value === 'string' ? success(value) : failTypeOf(value);
}

/**
 * Given any value input produces a parsed number or a failure. Uses
 * `typeof value === 'number'`:
 *
 *    const result = parseString(100);
 *    if (isSuccess(result)) {
 *         const value: string = result.value;
 *    } else {
 *         throw new Error(result.reason);
 *    }
 */
export function parseNumber<I>(value: I): Result<I,number> {
    return typeof(value) === 'number' ? success(value) : failTypeOf(value);
}

/**
 * Parses for `undefined` type.
 *
 *     const result = parseUndefined(undefined);
 *
 *     if (isFailure(result)) {
 *         throw new Error(result.reason);
 *     }
 */
export function parseUndefined<I>(value: I): Result<I,undefined> {
    return value === undefined ? success(undefined) : failTypeOf(value);
}

/**
 * Parses a boolean value.
 *
 *     const result = parseBoolean(true);
 *
 *     if (isFailure(result)) {
 *         throw new Error(result.reason);
 *     }
 */
export function parseBoolean<I>(value: I): Result<I,boolean> {
    return typeof(value) === 'boolean' ? success(value) : failTypeOf(value);
}

/**
 * A parser that allows any value. To be used in cases where a JSON value is not clearly
 * documented or described.
 *
 *      const parse = parseObjectOf({something: parseAnyValue});
 *
 *      const result = parse({something: 'anything'});
 *
 *      if (isFailure(result)) {
 *          throw new Error(result.reason);
 *      }
 */
export function parseAnyValue<I>(value: I): Success<any> {
    return success(value);
}

/**
 * A parser that succeeds with a value that conforms to Object.
 *
 *      const result = parseObject({a: 1});
 *      if (isFailure(result)) {
 *          throw new Error(result.reason);
 *      }
 *
 */
export function parseObject<I>(value: I): Result<I, Object> {
    return typeof(value) === 'object' && value !== null ? success(value) : failTypeOf(value);
}

/**
 * A parser that succeeds with any value that is Array.isArray
 *
 *      const result = parseArray([]);
 *      if (isFailure(result)) {
 *          throw new Error(resurt.reason);
 *      }
 */
export function parseArray<I,O>(value: I): Result<I,O[]> {
    return Array.isArray(value) ? success(value) : failure(value, 'value is not Array.isArray');
}

/**
 * Returns a Parser<I,T> that parses an Object with the keys and values that match the
 * parsers provided.
 *
 *
 *     const parse = parseObjectOf({ name: parseString, age: parseNumber });
 *
 *     const result = parse({name: 'Ellen Ripley', age: 25});
 *
 *     if (isFailure(result)) {
 *         throw new Error(result.reason);
 *     }
 *
 */
export function parseObjectOf<I, T extends {}>(parsers: {[K in keyof T]: Parser<I, T[K]>}): Parser<I,T> {
    return function(value: any) {
        let result = {} as T;
        for (const key in parsers) {
            const parsed = parsers[key](value ? value[key] : undefined);
            if (isFailure(parsed)) {
                return keyedFailure(value, key, parsed);
            }
            result[key] = parsed.value;
        }
        return success(result);
    };
}

/**
 * Returns a Parser<I, O> that parsers the value at key is successful for the provided parser.
 *
 *     // O: {[string]: {name: string}}
 *     const parse = parseIndexedObjectOf(parseObjectOf({name: parseString}));
 *     const result = parse({'a': {name: 'Ellen Ripley'}});
 *
 *     if (isFailure(result)) {
 *         throw new Error(result.reason);
 *     }
 */
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

/**
 * Returns a parser that maps a Parser of type Parser<I,A> into a Parser<I,B> given a function
 * of A => Result<I, A>.
 *
 * For example, a parser that requires a positive number:
 *
 *     const parse = mapParser(
 *         parseNumber,
 *         num => num > 0 ? success(num) : failure(num, `${num} is less than 0`)
 *     );
 *
 *     const failed = parse(0); // Failure<I>
 *     const succeeded = parse(1); // Success<number>
 */
export function mapParser<I, A, B>(validator: Parser<I, A>, next: (value: A) => Result<I, B>): Parser<I, B> {
    return (value) => mapFailure(
        mapSuccess(validator(value), next),
        failure => ({...failure, value}),
    );
}

/**
 * Given a Result<I, A>, when it's a failure type returns the value returned by `next`.
 *
 *
 *      // result: Success<string>|Success<number>|Failure<any>
 *      const result = mapFailure(parseString(1), parseNumber(1));
 */
export function mapFailure<I, A, B>(result: Result<I, A>, next: (failure: Failure<I>) => B): (B | Success<A>) {
    return isFailure(result) ? next(result) : result;
}

/**
 *  Given a Result<I, A>, when it's successfull returns return value of next.
 *
 *  // result: string|Failure<any>
 *  const result = mapSuccess(parseString(1), stringValue => `Hello ${stringValue}`);
 */
export function mapSuccess<I, A, B>(result: Result<I, A>, next: (value: A) => B): (B | Failure<I>) {
    return isSuccess(result) ? next(result.value) : result;
}

/**
 * Branches over a Result<I, O>:
 *
 *     type Response = { type: 'success' | 'failure', body: any };
 *
 *     const response: Response = mapResult(
 *         parseString(1),
 *         numValue => ({type: 'success', body: numValue}),
 *         failure => ({type: 'failure', body: failure.reason})
 *     );
 */
export function mapResult<I, A, B, C>(result: Result<I, A>, success:(value: A) => B, failure:(failure: Failure<I>) => C): (B|C) {
    return isSuccess(result) ? success(result.value) : failure(result);
}

/**
 * Parses an array of values that each pass the given parser.
 *
 *     const parse = parseArrayOf(parseObjectOf({name: parseString}));
 *
 *     const result = parse(JSON.parse('[{"name": "Ellen Ripley"}]'));
 *
 *     if (isFailure(result)) {
 *         throw new Error(result.reason);
 *     }
 *
 *     const names = value(result).map(person => person.name);
 */
export function parseArrayOf<I, O>(parser: Parser<I,O>): Parser<I,O[]> {
    return mapParser(parseArray, (value: any[]) =>
        value.reduce<Result<I,O[]>>(
            (result, member, index) => mapSuccess(
                result,
                items => mapResult(
                    parser(member),
                    valid => success(items.concat([valid])),
                    failure => keyedFailure(value, index, failure)
                )
            ),
            success([])
        )
    )
}

/**
 * Given a list of parsers, returns a parser that succeeds with any of the parsers.
 *
 *    const parse = parseOneOf(parseNumber, parseExactly('Infinity'));
 *    const result = parse(1);
 *    const result1 = parse('Infinity');
 */
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

/**
 * Returns a parser that succeeds when the value is exactly equal to the `option`.
 *
 * Useful for building parsers of enumerable types:
 *
 *     const parse = parseOneOf( parseExactly('admin'), parseExactly('user') );
 *     type Option = ParserType<typeof parse>;
 *
 *     const admin: Option = 'admin'; // ok
 *     const user: Option = 'user'; // ok
 *     const other: Option = 'other'; // not ok!
 */
export function parseExactly<S extends (string|number|boolean)>(option: S): Parser<any, S> {
    return (value: any) => value === option ? success(option) : failure(value, `is not ${option}`);
}

/**
 * Builds a Success<T> result with the value.
 */
export function success<T>(value: T): Success<T> {
    return {
        value,
        type: 'success'
    }
}

/**
 * Unwraps the value of Success<T> to T
 */
export function value<T>(success: Success<T>): T {
    return success.value;
}

/**
 * Builds a failure result.
 */
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

/**
 * Guard function that refines a Result<I,O> to Success<O>.
 */
export function isSuccess<I,O>(result: Result<I,O>): result is Success<O> {
    return result.type === 'success';
}

/**
 * Guard function that refines Result<I,O> to Failure<I>.
 */
export function isFailure<I,O>(result: Result<I,O>): result is Failure<I> {
    return result.type === 'failure';
}
