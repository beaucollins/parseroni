# Parser for TypeScript

A delarative, composable library of JSON compatible value parsers.

## Install

```
npm install parseroni
```

## API

The gist: `Parser<I,O>` is a function that takes a type `I` in as its single argument and returns a `Result<I,O>`.

`Result<I,O>` is a union of `Success<O>|Failure<I>` which are container types that describe the success and failure branches of the `Parser<I,O>` logic.

This library was designed to be used with values returne from `JSON.parse`.

A basic JSON parser:

```ts
const parseJSON: Parser<any,any> = (input) => {
	try {
		return success(JSON.parse(input);
	} catch (error) {
		return failure(error.message, input);
	}
}
```

`Parser<any,any>` is not exactly useful when the goal is type safety. This library provides the building blocks to validate ad return JSON primitives and combinations of them.

### Utility functios

A set of functions to simplify working with `Result<I,O>` types.

#### `isSuccess`

`isSuccess` is a `guard` function that refines a `Result<I,O>` to `Success<O>`.

```ts
const result = parseString(1);

if (isSuccess(result)) {
	const value = result.value; // value _is_ a `string`
}
```

#### `isFailure`

`isFailure` is the logical inverse of `isSuccess` and refines the `Failure<I>` branch of a `Result<I, O>`:

```ts
const result = parseString('maybe a string');

if (isFailure(result)) {
	throw new Error(result.message);
}
```

#### `value`

`value` unwraps the boxed value of `Success<T>`. Allows the shape of `Success<T>` to be opaque to the user of this api.

```ts
const result = parseString('maybe a string');
if (isSuccess(result)) {
	const theString = value(result);
}
```

#### `success`

Bulids a `Success<T>` result case:

```ts
const parseInteger: Parser<any, number> = (maybeNumber) => {
	const int = parseInt(maybeNumber);
	return int === maybeNumber
		? success(int)
		: failure(`${maybeNumber} not an int`, maybeNumber);
}
```

#### `failure`

Builds a `Failure<T>` result case:

```ts
const parsePositive: Parser<any, number> = (maybeNumber) => {
	return typeof maybeNumber === 'number' && maybeNumber > 0
		? success(maybeNumber)
		: failure(`${maybeNumber} not a posistive number`, maybeNumber);
}
```

### Base Parsers

A set of parsers for non-container JSON literals that can be used to build more complex parsers.

- `parseString` is `Parser<any, string>`
- `parseNumber` is `Parser<any, number>
- `parseUndefined` is `Parser<any, undefined>`
- `parseNull` is `Parser<any, null>`
- `parseBoolean` is `Parser<any, boolean>`

```ts
const result = parseString(("maybe a string": any));

if (isFailure(result)) {
	throw new Error(result.reason);
}

const strValue = value(result);
```

### Parser Combinators

Combinators that combine parsers into more complex parsers.

#### `parseObjectOf`

`parseObjectOf` accepts key/value pairs of parsers and parses the key/value pairs of the value it receives.

```ts
const parsePerson = parseObjectOf({
	name: parseString,
	age: parseNumber,
	metInPerson: parseBoolean
});

const result = parsePerson({});

if (isFailure(result)) {
	throw new Error(result.reason);
}

const person = value(result);

// TypeScript knows person.name is a `string`.
console.log(`Hello ${person.name}`);
// TypeScript knows person.age is a `number`.
console.log(`Maybe born in`, (new Date()).getYear() - person.age);
```

#### `parseArrayOf`

For parsing values of type `Array<T>`.

Given any `Parser<I, O>`, succeeds when the input:

1. is an `Array`
2. each member of the `Array` succeeds the provider `Parser<I, O>`

`parseArrayOf` accepts a `Parser<I,O>` and returns a `Parser<I, Array<O>>`.

```ts
const parsePeople = parseArrayOf(parsePerson);

// Result<any, Array<{name: string, age: number, metInPerson: boolean}>>
const result = parsePeople(JSON.parse(someString));
```

#### `parseIndexedObjectOf`

For parsing values of type `{[string]: T}`.

Given a `Parser<any, T>` the returned parser succeeds when:

1. The value is an indexed object
2. Each member of the indexed object succeeds the provider `Parser<any, T>`

```ts
// An object that is an index of users, indexed by a string value
const parseUuser = parseObjectOf({username: parseString});
const parseUserIndex = parseIndexedObjectOf(parseUser);
```

#### `parseExactly`

Builds a parser that succeeds when the input is exactly equal to the provided value.

```ts
const parse = parseExactly('shipped');

const result = parse('pending');

if (isSuccess(result)) {
	const shipped: 'shipped' = result.value;
}
```

#### `parseOneOf`

Allows one of a list of parsers to succeed. Useful for parsing an enumeration of known values.

```ts
const parseStatus = parseOneOf(
	parseExactly('published'),
	parseExactly('draft')
);

// Result<any, 'published'|'draft'>
const result = parseStatus('other');
```

#### `optional`

Given any parser, returns a new parser that succeds when original parser succeeds _or_ the value is `null`.

```ts
const parse = optional(parseString);

// Result<any, (null|string)>
const result = parse(null);
```

#### `voidable`

Given any parser, returns a new parser that succeeds when the original parser succeeds _or_ the value is `undefined`.

```ts
const parse = voidable(parseString);

// Result<any, (undefined|string)>
const result = parse(undefined);
```

## Complex Example

```ts

import {
	ParserType,
	parseObjectOf,
	parseArrayOf,
	parseString,
	parseExactly,
	optional,
	mapParser,
	success,
	isSuccess,
} from 'parser';

const parseAuthor = parseObjectOf({
	username: parseString,
	avatar: optional(parseString),
});

const parsePost = parseObjectOf(
	title: parseString,
	status: parseOneOf(
		parseExactly('published'),
		parseExactly('draft'),
	),
	author: parseAuthor,
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
	publishedAt: mapParser(
		parseString,
		// assuming ISO8601 string
		string => success(new Date(string))
	),
);

/**
 * Expects JSON like:
 *
 * ```
 * {"posts": [...Post]}
 * ```
 */
const parseResponse = parseObjectOf({
	posts: parseArrayOf( parsePost )
})

/**
 * Chained with DOM fetch
 */
async function getPosts() {
	const response = await fetch('/api/site/awesome.blog/posts')
		.then(response => response.json())
		.then(parseResponse);

	/**
	 * Type guard to unwrap the parsed value
	 */
	if (isSuccess(response)) {
		// 🚀 The response was successfully parsed and is safely typed
		const postResponse = response.value;
		console.log(postResponse.posts);
		return;
	}
	throw new Error(response.reason);
}

// Use the types created by the parsers:

type Author = ParserType<typeof parseAuthor>;
type Post = ParserType<typeof parsePost>;

const author: Author = {
   username: 5, // 💥 Not a string!
};

const post: Post = {
	title: 'Hello World',
	status: 'other', // 💥 Not 'published' or 'draft'
	publishedAt: 1235500482, // 💥 Not a Date
};

```