import {
    Parser,
    Result,
    parseBoolean,
    parseNumber,
    parseString,
    parseUndefined,
    parseExactly,
    failure,
    success,
    parseArrayOf,
    parseObjectOf,
    optional,
    parseOneOf,
    parseIndexedObjectOf,
} from '../src/parse';

describe('fractal/parse', () => {

    describe('isString', () => {
        it('succeeds', () => {
            const parser: Parser<any, string> = parseString;
            const value: Result<any, string> = parser( 'yes' );
            expect(value).toEqual(success('yes'));
        } )

        it('fails', () => {
            const parser: Parser<any, string> = parseString;
            const value = parser( 1 );
            expect(value).toEqual(failure(1, 'typeof value is number'));
        });
    });

    describe('arrayOf', () => {
        it('succeeds', () => {
            const value = parseArrayOf(parseNumber)([1, 2, 3]);
            expect(value).toEqual(success([1, 2, 3]));
        });

        it('fails', () => {
            const value = parseArrayOf(parseNumber)([1, '2', 3]);
            expect(value).toEqual(failure([1, '2', 3], 'Failed at \'1\': typeof value is string'));
        });
    })

    describe('optional', () => {
        it('succeeds', () => {
            const parser = parseArrayOf(optional(parseNumber));
            const result = parser([1, null, 3]);
            expect(result).toEqual(success([1, null, 3]));
        });

        it('fails', () => {
            const parser = parseArrayOf(optional(parseNumber));
            const result = parser([1, false, 3]);
            expect(result).toEqual(failure([1, false, 3], 'Failed at \'1\': typeof value is boolean'));
        });
    });

    describe('objectOf', () => {
        it('succeeds', () => {
            type Record = {
                artist: string,
                yearReleased: number,
                name: string,
            };

            const parser = parseObjectOf<any, Record>({
                artist: parseString,
                yearReleased: parseNumber,
                name: parseString,
            });

            const record = {
                artist: 'The Beatles',
                name: 'Revolver',
                yearReleased: 1966,
            };
            const result = parser(record);

            expect(result).toEqual(success(record));
        })

        it('fails', () => {
            type Thing = {name: string};
            const parser = parseObjectOf<any, Thing>({'name': parseString});
            const result = parser({'some-key': 1});

            expect(result).toEqual(failure({'some-key': 1}, 'Failed at \'name\': typeof value is undefined'));
        });

        it('allows undefined keys', () => {
            const parser = parseObjectOf({
                name: parseString,
                age: parseOneOf(parseUndefined, parseString)
            });
            expect(parser({})).toEqual(failure({}, 'Failed at \'name\': typeof value is undefined'));
            expect(parser({name: 'Hello', age: 10})).toEqual(failure({name: 'Hello', age: 10}, 'Failed at \'age\': \'10\' did not match any of 2 validators'))
            expect(parser({name: 'Hello'})).toEqual(success({name: 'Hello'}))
        })

        it('nests', () => {
            const parse = parseObjectOf({
                name: parseString,
                child: parseObjectOf({
                   id: parseNumber
                }),
            });

            const valid = {
                name: 'Valid',
                child: { id: 1 },
            };

            const invalid = {
                name: 'Invalid',
                child: { id: 'not-number' },
            };

            expect(parse(valid)).toEqual(success(valid));
            expect(parse(invalid)).toEqual(failure(invalid, 'Failed at \'child\': Failed at \'id\': typeof value is string' ));
        })
    })

    describe('indexedObjectOf', () => {
        const parser = parseIndexedObjectOf(parseOneOf(parseExactly('one'), parseExactly(1)));

        it('succeeds', () => {
            const value = {a: 'one', b: 1};
            expect(parser(value)).toEqual(success(value));
        });
    })

    describe('oneOf', () => {
        it('validates multiple validators', () => {
            const year = parseOneOf(parseNumber, parseString, parseBoolean);

            expect(year(2015)).toEqual(success(2015));
            expect(year('2015')).toEqual(success('2015'));
            expect(year(true)).toEqual(success(true));

            expect(year(null)).toEqual(failure(null, '\'null\' did not match any of 3 validators'));
        })
    });

    describe('arrayOf oneOf', () => {
        const validator = parseArrayOf(parseOneOf(parseNumber, parseBoolean));

        it('succeeds', () => {
            expect(validator([])).toEqual(success([]));
            expect(validator([1, 2, true, false])).toEqual(success([1, 2, true, false]));
            expect(validator([null, true])).toEqual(failure([null, true], 'Failed at \'0\': \'null\' did not match any of 2 validators'));
        })
    });

    describe('oneOf var', () => {
        const parser = parseOneOf(
            parseNumber,
            parseBoolean,
            parseString,
            parseObjectOf({
                name: parseString,
            })
        );
        it('succeeds', () => {
            expect(parser(1)).toEqual(success(1));
            expect(parser('a')).toEqual(success('a'));
        })
    })
});
