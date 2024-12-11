import {
    createToken,
    EmbeddedActionsParser,
    ILexingError,
    IRecognitionException,
    IToken,
    Lexer,
    TokenType
} from "chevrotain";

export type ParserResult<T> = { value?: T, errors: ParserError[] }
export type ParserError = { level: ParserErrorLevel, message: string, pos: ParserInfo }
export type ParserErrorLevel = 'error' | 'warning' | 'info' | 'hint'
export type AmlStatement = AmlEmptyLine | AmlEntity
export type AmlEmptyLine = { kind: 'Empty', pos: ParserInfo }
export type AmlEntity = { kind: 'Entity', name: AmlIdentifier, attrs: AmlAttribute[], pos: ParserInfo }
export type AmlAttribute = { name: AmlIdentifier, type: AmlIdentifier, pk: AmlKeyword | undefined, ref: AmlReference | undefined, pos: ParserInfo }
export type AmlReference = { keyword: AmlKeyword, entity: AmlIdentifier, attr: AmlIdentifier, pos: ParserInfo }
export type AmlIdentifier = { value: string, token: ParserInfo }
export type AmlKeyword = { token: ParserInfo }
export type ParserInfo = { offset: ParserOffset, position: ParserPosition }
export type ParserOffset = { start: EditorOffset, end: EditorOffset }
export type ParserPosition = { start: EditorPosition, end: EditorPosition }
export type EditorOffset = number
export type EditorPosition = { line: number, column: number }

export function parseAml(content: string): ParserResult<AmlStatement[]> {
    const lexingResult = lexer.tokenize(content)
    parser.input = lexingResult.tokens // "input" is a setter which will reset the parser's state.
    const res = parser.statementsRule()
    const errors = lexingResult.errors.map(formatLexerError).concat(parser.errors.map(formatParserError))
    return {value: res, errors: errors}
}

const Identifier = createToken({name: 'Identifier', pattern: /\b[a-zA-Z_][a-zA-Z_0-9]*\b/})
const PrimaryKey = createToken({name: 'PrimaryKey', pattern: /\bpk\b/, longer_alt: Identifier})
const ParenLeft = createToken({name: 'ParenLeft', pattern: /\(/})
const ParenRight = createToken({name: 'ParenRight', pattern: /\)/})
const Dash = createToken({ name: 'Dash', pattern: /-/ })
const GreaterThan = createToken({name: 'GreaterThan', pattern: />/})
const NewLine = createToken({name: 'NewLine', pattern: /\n/})
const WhiteSpace = createToken({name: 'WhiteSpace', pattern: / /})
const allTokens: TokenType[] = [WhiteSpace, NewLine, GreaterThan, Dash, ParenRight, ParenLeft, PrimaryKey, Identifier]

class AmlParser extends EmbeddedActionsParser {
    statementsRule: () => AmlStatement[]
    statementRule: () => AmlStatement
    emptyRule: () => AmlEmptyLine
    entityRule: () => AmlEntity
    attributeRule: () => AmlAttribute
    primaryKeyRule: () => AmlKeyword
    referenceRule: () => AmlReference
    identifierRule: () => AmlIdentifier
    constructor(tokens: TokenType[]) {
        super(tokens, {recoveryEnabled: true})
        const $ = this
        this.statementsRule = $.RULE<() => AmlStatement[]>('statementsRule', () => {
            const stmts: AmlStatement[] = []
            $.MANY(() => stmts.push($.SUBRULE($.statementRule)))
            return stmts.filter(s => s !== undefined) // can be undefined on invalid input :/
        })
        this.statementRule = $.RULE<() => AmlStatement>('statementRule', () => $.OR([
            {ALT: () => $.SUBRULE($.emptyRule)},
            {ALT: () => $.SUBRULE($.entityRule)},
        ]))
        this.emptyRule = $.RULE<() => AmlEmptyLine>('emptyRule', () => {
            return {kind: 'Empty', pos: tokenInfo($.CONSUME(NewLine))}
        })
        this.entityRule = $.RULE<() => AmlEntity>('entityRule', () => {
            const name = $.SUBRULE($.identifierRule)
            $.CONSUME(NewLine)
            const attrs: AmlAttribute[] = []
            $.MANY(() => attrs.push($.SUBRULE($.attributeRule)))
            const pos = mergeInfos(name.token, attrs.length > 0 ? attrs[attrs.length - 1].pos : name.token)
            return {kind: 'Entity', name, attrs: attrs.filter(s => s !== undefined), pos} // can be undefined on invalid input :/
        })
        this.attributeRule = $.RULE<() => AmlAttribute>('attributeRule', () => {
            $.CONSUME(WhiteSpace)
            $.CONSUME2(WhiteSpace)
            const name = $.SUBRULE($.identifierRule)
            $.CONSUME3(WhiteSpace)
            const type = $.SUBRULE2($.identifierRule)
            $.OPTION(() => $.CONSUME4(WhiteSpace))
            const pk = $.OPTION2(() => $.SUBRULE($.primaryKeyRule))
            const ref = $.OPTION3(() => $.SUBRULE($.referenceRule))
            $.CONSUME(NewLine)
            return {name, type, pk, ref, pos: mergeInfos(name.token, ref?.pos || pk?.token || type.token)}
        })
        this.primaryKeyRule = $.RULE<() => AmlKeyword>('primaryKeyRule', () => {
            const token = tokenInfo($.CONSUME(PrimaryKey))
            $.OPTION(() => $.CONSUME(WhiteSpace))
            return {token}
        })
        this.referenceRule = $.RULE<() => AmlReference>('referenceRule', () => {
            const keyword: AmlKeyword = {token: tokenInfo2($.CONSUME(Dash), $.CONSUME(GreaterThan))}
            $.CONSUME(WhiteSpace)
            const entity = $.SUBRULE($.identifierRule)
            $.CONSUME(ParenLeft)
            const attr = $.SUBRULE2($.identifierRule)
            return {keyword, entity, attr, pos: mergeInfos(keyword.token, tokenInfo($.CONSUME(ParenRight)))}
        })
        this.identifierRule = $.RULE<() => AmlIdentifier>('identifierRule', () => {
            const token = $.CONSUME(Identifier)
            return {value: token.image, token: tokenInfo(token)}
        })
        this.performSelfAnalysis()
    }
}

const lexer = new Lexer(allTokens)
const parser = new AmlParser(allTokens)

function tokenInfo(token: IToken): ParserInfo {
    return {
        offset: {start: pos(token.startOffset), end: pos(token.endOffset)},
        position: {
            start: {line: pos(token.startLine), column: pos(token.startColumn)},
            end: {line: pos(token.endLine), column: pos(token.endColumn)}
        }
    }
}

function tokenInfo2(start: IToken, end: IToken): ParserInfo {
    return {
        offset: {start: pos(start.startOffset), end: pos(end.endOffset)},
        position: {
            start: {line: pos(start.startLine), column: pos(start.startColumn)},
            end: {line: pos(end.endLine), column: pos(end.endColumn)}
        }
    }
}

function mergeInfos(start: ParserInfo | undefined, end: ParserInfo | undefined): ParserInfo {
    return {
        offset: {start: pos(start?.offset.start), end: pos(end?.offset.end)},
        position: {
            start: {line: pos(start?.position.start.line), column: pos(start?.position.start.column)},
            end: {line: pos(end?.position.end.line), column: pos(end?.position.end.column)}
        }
    }
}

function pos(value: number | undefined): number {
    return value !== undefined && !Number.isNaN(value) ? value : -1
}

function formatLexerError(err: ILexingError): ParserError {
    return {
        level: 'error',
        message: err.message,
        pos: {
            offset: {start: pos(err.offset), end: pos(err.offset) + err.length},
            position: {
                start: {line: pos(err.line), column: pos(err.column)},
                end: {line: pos(err.line), column: pos(err.column) + err.length}
            }
        }
    }
}

function formatParserError(err: IRecognitionException): ParserError {
    return {level: 'error', message: err.message, pos: tokenInfo(err.token)}
}
