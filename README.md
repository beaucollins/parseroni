# Parser for TypeScript

Born as an attempt to be a lightweight type-safe runtime JSON parser.

```ts

import {
	parseObjectOf,
	parseArrayOf,
	parseString,
	parseExactly,
	optional,
	mapParser,
	success
} from 'parser';

const parseAuthor = parseObjectOf(
	username: parseString,
	avatar: optional(parseString),
);

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

const parseResponse = parseObjectOf( {
	posts: parseArrayOf( parsePost )
} );

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