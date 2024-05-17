import {Position, SyntaxError} from ".";

export enum KeywordKind {
    circuit = 1,
    variable,
    to,
    any,
    in,
    out,
    set,
    assign,
}

export enum TokenKind {
    keyword,
    literal,
}

export interface Keyword {
    readonly kind: TokenKind.keyword;
    readonly value: KeywordKind;
    readonly position: Position;
}

export class Literal {
    declare kind: TokenKind.literal;

    constructor(
        readonly position: Position,
        readonly source: string,
        readonly start: number,
        readonly end: number,
    ) {}

    value(): string {
        return this.source.slice(this.start, this.end);
    }
}

Literal.prototype.kind = TokenKind.literal;

export type Token = Keyword | Literal;

function nextNonSpace(text: string, start: number): [lines: number, lineStart: number, offset: number] {
    let lines = 0;
    let lineStart = -1;
    while (start < text.length) switch (text[start]) {
        case '\n':
            if (text[start - 1] === '\r') break; // windows..
        case '\r':
            ++lines;
            lineStart = start + 1;
        case ' ':
        case '\t':
        case '\f':
        case '\v':
            ++start;
            break;

        default:
            return [lines, lineStart, start];
    }

    return [lines, lineStart, text.length];
}

function nextSpace(text: string, start: number): number {
    while (start < text.length) switch (text[start]) {
        case '\n':
        case '\r':
        case ' ':
        case '\t':
        case '\f':
        case '\v':
            return start;

        default:
            ++start;
    }

    return text.length;
}

export function* tokenize(source: string): Generator<Token> {
    let line = 1;
    let lineStart = 0;

    for (let n = 0;;) {
        const [lines, newLineStart, skipped] = nextNonSpace(source, n);
        n = skipped;
        line += lines;
        if (newLineStart > -1)
            lineStart = newLineStart;

        if (n >= source.length)
            break;

        const position = {line, char: n - lineStart};

        if (source[n] === `"`) {
            const end = source.indexOf(`"`, n + 1);
            if (end < 0) throw new SyntaxError(
                position, "Quoted name with no end, did you forget a double quote?");

            yield new Literal(position, source, n + 1, end);
            n = end + 1;
        } else {
            const end = nextSpace(source, n);
            const text = source.slice(n, end);
            const keyword = KeywordKind[text.toLocaleLowerCase() as keyof typeof KeywordKind];
            yield keyword ?
                {
                    position,
                    kind: TokenKind.keyword,
                    value: keyword
                }
                : new Literal(position, source, n, end);
    
            n = end;
        }
    }
}
