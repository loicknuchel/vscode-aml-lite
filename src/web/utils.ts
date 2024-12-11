import * as vscode from "vscode";
import {EditorPosition, ParserError, ParserErrorLevel, ParserPosition} from "./parser";

export function positionToAml(position: vscode.Position): EditorPosition {
    return {line: position.line + 1, column: position.character + 1}
}

export function errorToDiagnostic(e: ParserError): vscode.Diagnostic {
    return new vscode.Diagnostic(tokenToRange(e.pos.position), e.message, levelToSeverity(e.level))
}

export function tokenToRange(position: ParserPosition): vscode.Range {
    return new vscode.Range(position.start.line - 1, position.start.column - 1, position.end.line - 1, position.end.column)
}

function levelToSeverity(level: ParserErrorLevel): vscode.DiagnosticSeverity {
    if (level === 'error') { return vscode.DiagnosticSeverity.Error }
    else if (level === 'warning') { return vscode.DiagnosticSeverity.Warning }
    else if (level === 'info') { return vscode.DiagnosticSeverity.Information }
    else if (level === 'hint') { return vscode.DiagnosticSeverity.Hint }
    return vscode.DiagnosticSeverity.Error
}

export function isInside(position: EditorPosition, token: ParserPosition): boolean {
    const line = position.line
    const col = position.column
    const inLines = token.start.line < line && line < token.end.line
    const startLine = line === token.start.line && token.start.column <= col && (col <= token.end.column || line < token.end.line)
    const endLine = line === token.end.line && col <= token.end.column && (token.start.column <= col || token.start.line < line)
    return inLines || startLine || endLine
}

type Timeout = ReturnType<typeof setTimeout>
export function debounce<F extends (...args: Parameters<F>) => ReturnType<F>>(
    func: F,
    delay: number
): (...args: Parameters<F>) => void {
    let timeout: Timeout
    return (...args: Parameters<F>): void => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), delay)
    }
}

export function groupBy<T, K extends keyof any>(list: T[], getKey: (item: T) => K): Record<K, T[]> {
    return list.reduce((acc, item) => {
        const key = getKey(item)
        if (!acc[key]) { acc[key] = [] }
        acc[key].push(item)
        return acc
    }, {} as Record<K, T[]>)
}
