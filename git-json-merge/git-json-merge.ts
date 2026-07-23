import xdiff from 'xdiff'
import { parse } from '@std/jsonc'

interface JsonValue {
  [key: string]: unknown
}

/**
 * Merge JSON files using a three-way merge algorithm
 */
export async function mergeJsonFiles(
  oursFileName: string,
  baseFileName: string,
  theirsFileName: string,
): Promise<void> {
  const oursJson = stripBom(await Deno.readTextFile(oursFileName))
  const baseJson = stripBom(await Deno.readTextFile(baseFileName))
  const theirsJson = stripBom(await Deno.readTextFile(theirsFileName))
  const newOursJson = mergeJson(oursJson, baseJson, theirsJson)
  console.log(
    'Writing merged JSON to',
    oursFileName,
    `, content: ${newOursJson}`,
  )
  await Deno.writeTextFile(oursFileName, newOursJson)
}

/**
 * Merge JSON strings preserving indentation
 */
export function mergeJson(
  oursJson: string,
  baseJson: string,
  theirsJson: string,
): string {
  const oursIndent = detectIndent(oursJson)
  const baseIndent = detectIndent(baseJson)
  const theirsIndent = detectIndent(theirsJson)
  const newOursIndent = selectIndent(oursIndent, baseIndent, theirsIndent)

  const ours = parse(oursJson) as JsonValue
  const base = parse(baseJson) as JsonValue
  const theirs = parse(theirsJson) as JsonValue

  if (ours === null || base === null || theirs === null) {
    throw new Error('Invalid JSON: one of the input files contains null')
  }

  const newOurs = merge(ours, base, theirs)
  return JSON.stringify(newOurs, null, newOursIndent)
}

/**
 * Merge JavaScript objects using three-way merge
 */
export function merge(
  ours: JsonValue,
  base: JsonValue,
  theirs: JsonValue,
): JsonValue {
  console.log('Starting merge process')
  console.log('Ours:', JSON.stringify(ours))
  console.log('Base:', JSON.stringify(base))
  console.log('Theirs:', JSON.stringify(theirs))

  const diff = xdiff.diff3(ours, base, theirs)
  if (!diff) {
    console.log('No conflicts detected')
    return base
  }

  console.log('Conflicts detected, applying patch')
  console.log('Diff:', JSON.stringify(diff))
  const patched = xdiff.patch(base, diff)
  console.log('Patched result:', JSON.stringify(patched))
  return patched
}

function detectIndent(str: string): number {
  const match = str.match(/^[ \t]+/m)
  return match ? match[0].length : 2
}

export function selectIndent(
  oursIndent: number,
  baseIndent: number,
  theirsIndent: number,
): number {
  return oursIndent !== baseIndent
    ? oursIndent
    : theirsIndent !== baseIndent
    ? theirsIndent
    : baseIndent
}

export function stripBom(str: string): string {
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str
}
