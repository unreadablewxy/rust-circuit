export interface Position {
    line: number;
    char: number;
}

export class SyntaxError extends Error {
    constructor(public readonly position: Position, message: string) {
        super(message);
    }
}

export class SemanticsError extends Error {
    constructor(public readonly position: Position, message: string) {
        super(message);
    }
}

export {Interpreter} from "./interpreter";
