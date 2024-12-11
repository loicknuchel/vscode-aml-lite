import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-aml-lite.helloWorld', () => vscode.window.showInformationMessage('Hello World from vscode-aml-lite!')),
	)
}

export function deactivate() {}
