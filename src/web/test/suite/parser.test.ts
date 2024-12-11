import * as assert from "assert";
import {
    AmlAttribute,
    AmlEmptyLine,
    AmlEntity,
    AmlIdentifier,
    AmlKeyword,
    AmlReference,
    parseAml,
    ParserInfo
} from "../../parser";

suite('aml', () => {
    test('parseAml', () => {
        const content = `users
  id int pk
  name varchar

posts
  id int pk
  title varchar
  author int -> users(id)
`
        assert.deepStrictEqual(parseAml(content), {value: {statements: [
            entity(1, 0, 'users', [
                {name: 'id', type: 'int', pk: true},
                {name: 'name', type: 'varchar'},
            ]),
            empty(4, 33),
            entity(5, 34, 'posts', [
                {name: 'id', type: 'int', pk: true},
                {name: 'title', type: 'varchar'},
                {name: 'author', type: 'int', ref: {entity: 'users', attr: 'id'}},
            ])
        ]}, errors: []})
    })
})

type AstAttribute = {name: string, type: string, pk?: boolean, ref?: AstReference}
type AstReference = {entity: string, attr: string}

function empty(line: number, offset: number): AmlEmptyLine {
    return {kind: 'Empty', pos: position(offset, line, 1, offset, line, 1)}
}

function entity(line: number, offset: number, name: string, attrs: AstAttribute[]): AmlEntity {
    const nameId = identifier(name, offset, line, 1)
    let prev = nameId.token
    const attrIds = attrs.map(a => {
        const res = attr(a, prev.position.end.line + 1, prev.offset.end + 4)
        prev = res.pos
        return res
    })
    const end = attrIds.length > 0 ? attrIds[attrIds.length - 1].pos : nameId.token
    return {kind: 'Entity', name: nameId, attrs: attrIds, pos: position(offset, line, 1, end.offset.end, end.position.end.line, end.position.end.column)}
}

function attr(attr: AstAttribute, line: number, offset: number): AmlAttribute {
    const nameId = identifier(attr.name, offset, line, 3)
    const typeId = identifier(attr.type, nameId.token.offset.end + 2, line, nameId.token.position.end.column + 2)
    const pkId = attr.pk ? keyword(typeId.token.offset.end + 2, 2, line, typeId.token.position.end.column + 2) : undefined
    const refId = attr.ref ? reference(attr.ref, (pkId?.token || typeId.token).offset.end + 2, line, (pkId?.token || typeId.token).position.end.column + 2) : undefined
    const end = refId?.pos || pkId?.token || typeId.token
    return {name: nameId, type: typeId, pk: pkId, ref: refId, pos: position(offset, line, 3, end.offset.end, line, end.position.end.column)}
}

function reference(ref: AstReference, offset: number, line: number, column: number): AmlReference {
    const keywordId = keyword(offset, 2, line, column)
    const entityId = identifier(ref.entity, keywordId.token.offset.end + 2, line, keywordId.token.position.end.column + 2)
    const attrId = identifier(ref.attr, entityId.token.offset.end + 2, line, entityId.token.position.end.column + 2)
    return {keyword: keywordId, entity: entityId, attr: attrId, pos: position(offset, line, column, attrId.token.offset.end + 1, line, attrId.token.position.end.column + 1)}
}

function identifier(value: string, offset: number, line: number, column: number): AmlIdentifier {
    return {value, token: token(offset, value.length, line, column)}
}

function keyword(offset: number, length: number, line: number, column: number): AmlKeyword {
    return {token: token(offset, length, line, column)}
}

function token(offset: number, length: number, line: number, column: number): ParserInfo {
    return {offset: {start: offset, end: offset + length - 1}, position: {start: {line, column}, end: {line, column: column + length - 1}}}
}

function position(offset: number, line: number, column: number, offsetEnd: number, lineEnd: number, columnEnd: number): ParserInfo {
    return {offset: {start: offset, end: offsetEnd}, position: {start: {line, column}, end: {line: lineEnd, column: columnEnd}}}
}
