import * as vscode from "vscode";
import {AmlIdentifier, AmlStatement, EditorPosition, parseAml, ParserInfo} from "./parser";
import {isInside, positionToAml, tokenToRange} from "./utils";

// https://code.visualstudio.com/api/references/vscode-api#RenameProvider
export class AmlRename implements vscode.RenameProvider {
    prepareRename?(
        doc: vscode.TextDocument,
        pos: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Range | { range: vscode.Range; placeholder: string; }> {
        const res = parseAml(doc.getText())
        if (!res.value) { throw new Error("Can't rename with errors") }
        const item = findItem(res.value, positionToAml(pos))
        if (!item) { throw new Error('Unsupported rename') }
        return tokenToRange(item.pos.position)
    }

    provideRenameEdits(
        doc: vscode.TextDocument,
        pos: vscode.Position,
        newName: string,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.WorkspaceEdit> {
        const res = parseAml(doc.getText())
        if (!res.value) { throw new Error("Can't rename with errors") }
        const item = findItem(res.value, positionToAml(pos))
        if (!item) { throw new Error('Unsupported rename') }
        const edits = new vscode.WorkspaceEdit()
        itemPositions(res.value, item).forEach(p => edits.replace(doc.uri, tokenToRange(p.position), newName))
        return edits
    }
}

type AmlItem = EntityItem | AttributeItem | TypeItem
type EntityItem = { kind: 'Entity', pos: ParserInfo, entity: AmlIdentifier }
type AttributeItem = { kind: 'Attribute', pos: ParserInfo, entity: AmlIdentifier, attr: AmlIdentifier }
type TypeItem = { kind: 'Type', pos: ParserInfo, type: AmlIdentifier }

function findItem(ast: AmlStatement[], pos: EditorPosition): AmlItem | undefined {
    const s = ast.find(s => isInside(pos, s.pos.position))
    if (s?.kind === 'Entity') {
        if (inside(pos, s.name)) { return entityItem(s.name) }
        const a = s.attrs.find(a => isInside(pos, a.pos.position))
        if (a) {
            if (inside(pos, a.name)) { return attributeItem(s.name, a.name) }
            if (inside(pos, a.type)) { return typeItem(a.type) }
            if (a.ref) {
                if (inside(pos, a.ref.entity)) { return entityItem(a.ref.entity) }
                if (inside(pos, a.ref.attr)) { return attributeItem(a.ref.entity, a.ref.attr) }
            }
        }
    }
    return undefined
}

function itemPositions(ast: AmlStatement[], item: AmlItem): ParserInfo[] {
    const identifiers: AmlIdentifier[] = []
    ast.forEach(s => {
        if (s.kind === 'Entity') {
            if (isEntity(item, s.name)) { identifiers.push(s.name) }
            s.attrs.forEach(a => {
                if (isAttribute(item, s.name, a.name)) { identifiers.push(a.name) }
                if (isType(item, a.type)) { identifiers.push(a.type) }
                if (a.ref) {
                    if (isEntity(item, a.ref.entity)) { identifiers.push(a.ref.entity) }
                    if (isAttribute(item, a.ref.entity, a.ref.attr)) { identifiers.push(a.ref.attr) }
                }
            })
        }
    })
    return identifiers.map(t => t.token)
}

const inside = (pos: EditorPosition, item: { token: ParserInfo }): boolean => isInside(pos, item.token.position)
const entityItem = (entity: AmlIdentifier): EntityItem => ({kind: 'Entity', pos: entity.token, entity})
const attributeItem = (entity: AmlIdentifier, attr: AmlIdentifier): AttributeItem => ({kind: 'Attribute', pos: attr.token, entity, attr})
const typeItem = (type: AmlIdentifier): TypeItem => ({kind: 'Type', pos: type.token, type})
const isEntity = (item: AmlItem, entity: AmlIdentifier): boolean => item.kind === 'Entity' && item.entity.value === entity.value
const isAttribute = (item: AmlItem, entity: AmlIdentifier, attr: AmlIdentifier): boolean => item.kind === 'Attribute' && item.entity.value === entity.value && item.attr.value === attr.value
const isType = (item: AmlItem, type: AmlIdentifier): boolean => item.kind === 'Type' && item.type.value === type.value
