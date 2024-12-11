import * as vscode from "vscode";
import {ParserError, ParserErrorLevel, ParserPosition} from "./parser";

export function errorToDiagnostic(e: ParserError): vscode.Diagnostic {
    return new vscode.Diagnostic(tokenToRange(e.pos.position), e.message, levelToSeverity(e.level))
}

function tokenToRange(position: ParserPosition): vscode.Range {
    return new vscode.Range(position.start.line - 1, position.start.column - 1, position.end.line - 1, position.end.column)
}

function levelToSeverity(level: ParserErrorLevel): vscode.DiagnosticSeverity {
    if (level === 'error') { return vscode.DiagnosticSeverity.Error }
    else if (level === 'warning') { return vscode.DiagnosticSeverity.Warning }
    else if (level === 'info') { return vscode.DiagnosticSeverity.Information }
    else if (level === 'hint') { return vscode.DiagnosticSeverity.Hint }
    return vscode.DiagnosticSeverity.Error
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
