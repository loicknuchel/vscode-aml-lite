import * as vscode from "vscode";
import {AmlEntity, AmlStatement, parseAml} from "./parser";

const attrTypes = ['int', 'bigint', 'numeric', 'varchar', 'text', 'boolean', 'uuid', 'timestamp', 'json', 'jsonb']

export class AmlCompletion implements vscode.CompletionItemProvider {
    provideCompletionItems(
        doc: vscode.TextDocument,
        pos: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const res = parseAml(doc.getText())
        if (res.value) {
            const line = doc.lineAt(pos.line).text.slice(0, pos.character)
            return computeSuggestions(line, res.value)
        }
    }
}

type AttrRef = {entity: string, attr: string}
type Suggestion = {kind: SuggestionKind, insert: string, label?: string}
type SuggestionKind = 'type' | 'relation'

function computeSuggestions(line: string, ast: AmlStatement[]): vscode.CompletionItem[] | undefined {
    const entities: AmlEntity[] = ast.filter(s => s.kind === 'Entity')
    const pks: AttrRef[] = entities.flatMap(e => e.attrs.flatMap(a => a.pk ? [{entity: e.name.value, attr: a.name.value}] : []))

    if (line.match(/^  [a-zA-Z_][a-zA-Z_0-9]*\b $/)) { // suggest attribute types
        return attrTypes.map(suggestType)
    }
    if (line.match(/^  [a-zA-Z_][a-zA-Z_0-9]*\b [a-zA-Z_][a-zA-Z_0-9]*\b $/)) { // suggest relations
        return pks.map(pk => suggestRelation(`-> ${pk.entity}(${pk.attr})`))
    }
    if (line.match(/^  [a-zA-Z_][a-zA-Z_0-9]*\b [a-zA-Z_][a-zA-Z_0-9]*\b -> $/)) { // suggest relation targets
        return pks.map(pk => suggestRelation(`${pk.entity}(${pk.attr})`))
    }
}

const suggestType = (type: string): vscode.CompletionItem => completionItem({kind: 'type', insert: type})
const suggestRelation = (insert: string): vscode.CompletionItem => completionItem({kind: 'relation', insert})

function completionItem(s: Suggestion): vscode.CompletionItem {
    const item = new vscode.CompletionItem(s.label || s.insert)
    item.kind = completionKind(s.kind)
    item.insertText = s.insert.includes('$') ? new vscode.SnippetString(s.insert) : s.insert
    return item
}

function completionKind(kind: SuggestionKind) {
    if (kind === 'type') { return vscode.CompletionItemKind.TypeParameter }
    if (kind === 'relation') { return vscode.CompletionItemKind.Interface }
    return vscode.CompletionItemKind.File
}
