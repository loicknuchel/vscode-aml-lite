import * as vscode from "vscode";
import {parseAml} from "./parser";
import {computeDiagnostics} from "./diagnostics";
import {AmlCompletion} from "./completion";
import {AmlRename} from "./rename";
import {AmlSymbols} from "./symbols";
import {debounce} from "./utils";

export function activate(context: vscode.ExtensionContext) {
	const diagnostics: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('amll')

	vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
		if (document.languageId === 'amll') {
			const content = document.getText()
			const res = parseAml(content)
			diagnostics.set(document.uri, computeDiagnostics(res))
		}
	}, null, context.subscriptions)
	vscode.workspace.onDidChangeTextDocument(debounce((event: vscode.TextDocumentChangeEvent) => {
		if (event.document.languageId === 'amll') {
			const content = event.document.getText()
			const res = parseAml(content)
			diagnostics.set(event.document.uri, computeDiagnostics(res))
		}
	}, 300), null, context.subscriptions)

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-aml-lite.helloWorld', () => vscode.window.showInformationMessage('Hello World from vscode-aml-lite!')),
		new vscode.Disposable(() => diagnostics.dispose()),
		vscode.languages.registerCompletionItemProvider({language: 'amll'}, new AmlCompletion(), ' ', '('),
		vscode.languages.registerRenameProvider({language: 'amll'}, new AmlRename()),
		vscode.languages.registerDocumentSymbolProvider({language: 'amll'}, new AmlSymbols()),
	)
}

export function deactivate() {}
