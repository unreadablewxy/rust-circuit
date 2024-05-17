import {SemanticsError, SyntaxError} from ".";
import {KeywordKind, Literal, Token, TokenKind, tokenize} from "./token";

function requireNext(tokens: Generator<Token>): Token {
    const result = tokens.next();
    if (result.done)
        throw new Error("Incomplete circuit definition, ended too soon");

    return result.value;
}

function stringifyToken(token: Token): string {
    return token.kind === TokenKind.literal
        ? token.value()
        : KeywordKind[token.value];
}

interface Terminal {
    name?: string;
}

interface Variable {
    name: string;
}

interface Component {
    name: string;
    outputs: Terminal[];
    inputs: Terminal[];
    properties: Variable[];
}

interface Connection {
    destination: string;
    to: string;
}

interface Device<T extends Component> {
    kind: T;
    name: string;
    outputs: Connection[];
}

interface Circuit<T extends Component> extends Component {
    devices: Device<T>[];
}

interface UnlinkedConnection {
    destination: Literal;
    to: Token;
}

interface UnlinkedDevice {
    kind: Component;
    name: string;
    outputs: UnlinkedConnection[];
    connections: Token[];
}

interface UnlinkedCircuit extends Component {
    devices: UnlinkedDevice[];
}

function findByName<T extends {name?: string}>(candidates: T[], comparand: string): T | null {
    for (let n = candidates.length; n --> 0;) {
        const def = candidates[n];
        if (def.name && def.name === comparand)
            return def;
    }

    return null;
}

interface Transition {
    token: Token;
    state: State;
}

interface State {
    offer(
        prior: Token | null,
        tokens: Generator<Token>,
        circuit: Circuit<Component>,
        interp: Interpreter<Component>,
    ): Transition | null;
}

export class Interpreter<T extends Component> {
    constructor(private readonly components: T[]) {}

    parse(text: string): Circuit<T> {
        const tokens = tokenize(text);
        const circuit: UnlinkedCircuit = {
            name: "",
            devices: [],
            inputs: [],
            outputs: [],
            properties: [],
        };

        let token = this.beginCircuit(tokens, circuit);
        for (;;) {
            if (!token) {
                const n = tokens.next();
                if (n.done)
                    break;

                token = n.value;
            }

            if (token.kind !== TokenKind.literal)
                throw new SyntaxError(token.position, "Expecting a component name");

            token = this.defineDevice(token, tokens, circuit);
        }

        return this.linkCircuit(circuit);
    }

    private beginCircuit(tokens: Generator<Token>, circuit: UnlinkedCircuit): Token | null {
        let t;
        if ((t = tokens.next()).done) return null;
        let token = t.value;

        if (token.kind !== TokenKind.keyword || token.value !== KeywordKind.circuit)
            throw new SyntaxError(token.position, "First directive of a circuit should be 'circuit'");

        if ((t = tokens.next()).done) return null;
        token = t.value;

        if (token.kind === TokenKind.literal) {
            circuit.name = token.value();

            if ((t = tokens.next()).done) return null;
            token = t.value;
        }

        for (;;) {
            let terminals;
            switch (token.value) {
            case KeywordKind.in: terminals = circuit.inputs; break;
            case KeywordKind.out: terminals = circuit.outputs; break;
            case KeywordKind.variable: terminals = circuit.properties; break;
            default: return t.value;
            }

            t = tokens.next();
            if (t.done || t.value.kind !== TokenKind.literal)
                throw new SyntaxError(token.position, "A terminal name is required");

            terminals.push({
                name: t.value.value(),
            });

            if ((t = tokens.next()).done) return null;
            token = t.value;

            if (token.kind !== TokenKind.keyword)
                return token;
        }
    }

    private defineConnection(
        token: Token,
        tokens: Generator<Token>,
        device: UnlinkedDevice,
    ): Token | null {
        let terminal = 0;
        if (token.kind === TokenKind.keyword) {
            switch (token.value) {
            case KeywordKind.in:
                throw new SyntaxError(token.position, "Don't worry about inputs, we'll infer those");

            case KeywordKind.out:
                if (device.kind.outputs.length > 1)
                    throw new SemanticsError(token.position, "Which output? There are more than one");
                if (device.kind.outputs.length < 1)
                    throw new SemanticsError(token.position, "This device has no outputs");
                break;

            default: return token;
            }
        } else {
            const name = token.value();
            terminal = device.kind.outputs.findIndex(o => o.name && o.name === name);
            if (terminal < 0)
                throw new SemanticsError(token.position, "No such output terminal");
        }

        token = requireNext(tokens);
        if (token.kind !== TokenKind.keyword || token.value !== KeywordKind.to)
            throw new SyntaxError(token.position, "Not a valid terminal action");

        const destination = requireNext(tokens);
        if (destination.kind !== TokenKind.literal)
            throw new SyntaxError(token.position, "To which device was the terminal connected?");

        const to = requireNext(tokens);
        if (to.kind === TokenKind.keyword) {
            switch (to.value) {
            case KeywordKind.in:
            case KeywordKind.any:
                break;

            default:
                throw new SyntaxError(token.position, "To which input are we connecting?");
            }
        }

        if (device.outputs[terminal])
            throw new SemanticsError(token.position, "Something is already said to be connected to this terminal");

        device.outputs[terminal] = {
            destination,
            to: token,
        };

        return null;
    }

    private defineDevice(
        first: Literal,
        tokens: Generator<Token>,
        circuit: UnlinkedCircuit,
    ): Token | null {
        const kind = findByName(this.components, first.value());
        if (!kind)
            throw new SemanticsError(first.position, "No such device type");

        let t;
        if ((t = tokens.next()).done) return null;
        let token: Token | null = t.value;

        if (token.kind !== TokenKind.literal)
            throw new SyntaxError(token.position, "Please name the device");

        const device: UnlinkedDevice = {
            kind,
            name: token.value(),
            outputs: [],
            connections: [],
        };

        circuit.devices.push(device);

        for (;;) {
            if (!token) {
                if ((t = tokens.next()).done) return null;
                token = t.value;
            }

            token = this.defineConnection(token, tokens, device);
        }
    }

    private linkCircuit(circuit: UnlinkedCircuit): Circuit<T> {
        const result: Circuit<T> = {
            ...circuit,
            devices: [],
        };

        for (const device of circuit.devices) {
            const linked: Device<T> = {
                kind: device.kind as T,
                name: device.name,
                outputs: [],
            };

            result.devices.push(linked);

            for (const connection of device.outputs) {
                const name = stringifyToken(connection.destination);
                const other = findByName(circuit.devices, name);
                if (!other) throw new SemanticsError(
                    connection.destination.position,
                    "no such device");

                let reason;
                if (other.kind.inputs.length < 1)
                    reason = "That device has no input terminals";
                else {
                    let socket: number = -1;
                    if (connection.to.kind === TokenKind.literal) {
                        const name = connection.to.value();
                        socket = other.kind.inputs.findIndex(v => v.name === name);
                        if (socket < 0)
                            reason = "No such input terminal";
                    } else if (connection.to.value === KeywordKind.in) {
                        if (other.kind.inputs.length > 1)
                            reason = "There are multiple inputs. If it doesn't matter which, specify 'any'";
                    }

                    if (socket >= 0 && other.connections[socket])
                        reason = "Destination is occupied";
                    else
                        other.connections[socket] = connection.to;
                }

                if (reason) throw new SemanticsError(connection.to.position, reason);
            }
        }

        return result;
    }
}
