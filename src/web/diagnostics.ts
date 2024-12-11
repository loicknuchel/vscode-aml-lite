import * as vscode from "vscode";
import {AmlEntity, AmlStatement, ParserError, ParserInfo, ParserResult} from "./parser";
import {errorToDiagnostic, groupBy} from "./utils";

export function computeDiagnostics(res: ParserResult<AmlStatement[]>): vscode.Diagnostic[] {
    const entities: AmlEntity[] = (res.value || []).filter(s => s.kind === 'Entity')
    const entitiesByName: Record<string, AmlEntity[]> = groupBy(entities, e => e.name.value)
    return res.errors.concat(
        duplicateEntities(entitiesByName),
        duplicateAttributes(entities),
        badReferences(entities, entitiesByName)
    ).map(errorToDiagnostic)
}

function duplicateEntities(entitiesByName: Record<string, AmlEntity[]>): ParserError[] {
    return Object.values(entitiesByName).filter(e => e.length > 1).flatMap(dups => dups.slice(1).map(e => {
        return warning(`'${e.name.value}' already defined at line ${dups[0].name.token.position.start.line}`, e.name.token)
    }))
}

function duplicateAttributes(entities: AmlEntity[]): ParserError[] {
    return entities.flatMap(e => Object.values(groupBy(e.attrs, a => a.name.value)).filter(a => a.length > 1).flatMap(dups => dups.slice(1).map(a => {
        return warning(`'${a.name.value}' already defined at line ${dups[0].name.token.position.start.line}`, a.name.token)
    })))
}

function badReferences(entities: AmlEntity[], entitiesByName: Record<string, AmlEntity[]>): ParserError[] {
    return entities.flatMap(e => e.attrs.flatMap(a => a.ref ? [a.ref] : [])).flatMap(r => {
        const e = entitiesByName[r.entity.value]?.[0]
        if (e) {
            const a = e.attrs.find(a => a.name.value === r.attr.value)
            return a ? [] : [warning(`'${r.attr.value}' not found in '${r.entity.value}' (line ${e.name.token.position.start.line})`, r.attr.token)]
        }
        return [warning(`'${r.entity.value}' does not exist`, r.entity.token)]
    })
}

const warning = (message: string, pos: ParserInfo): ParserError => ({level: 'warning', message, pos})
