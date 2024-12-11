import * as vscode from "vscode";
import {AmlEntity, AmlIdentifier, parseAml, ParserInfo} from "./parser";
import {tokenToRange} from "./utils";

// see https://microsoft.github.io/monaco-editor/typedoc/interfaces/languages.DocumentSymbolProvider.html
export class AmlSymbols implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const entities: AmlEntity[] = parseAml(document.getText()).value?.filter(s => s.kind === 'Entity') || []
        return entities.map(s => {
            const entity = symbol(s, vscode.SymbolKind.Class)
            entity.children = s.attrs.map(a => symbol(a, vscode.SymbolKind.Property))
            return entity
        })
    }
}

function symbol(e: { name: AmlIdentifier, pos: ParserInfo }, kind: vscode.SymbolKind): vscode.DocumentSymbol {
    return new vscode.DocumentSymbol(e.name.value, '', kind, tokenToRange(e.pos.position), tokenToRange(e.name.token.position))
}
