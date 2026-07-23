#!/usr/bin/env -S deno run --allow-read --allow-write
import { mergeJsonFiles } from './git-json-merge.ts'

const oursFileName = Deno.args[0]
const baseFileName = Deno.args[1]
const theirsFileName = Deno.args[2]

if (!oursFileName || !baseFileName || !theirsFileName) {
  console.error('Usage: cli.ts <ours> <base> <theirs>')
  Deno.exit(1)
}

await mergeJsonFiles(oursFileName, baseFileName, theirsFileName)
