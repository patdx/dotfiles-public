import { assertEquals } from '@std/assert'
import * as gitJsonMerge from './git-json-merge.ts'

function toString(object: unknown) {
  return JSON.stringify(object)
}

function clone<T>(object: T): T {
  return JSON.parse(JSON.stringify(object))
}

interface MergeJsonTestCase {
  ours: unknown
  base: unknown
  theirs: unknown
  expected: unknown
}

function createMergeJsonTest(
  { ours, base, theirs, expected }: MergeJsonTestCase,
): Deno.TestDefinition {
  const oursStr = toString(clone(ours))
  const baseStr = toString(clone(base))
  const theirsStr = toString(clone(theirs))
  const expectedStr = toString(clone(expected))

  return {
    name: `merge: ours=${oursStr} base=${baseStr} theirs=${theirsStr}`,
    fn: () => {
      const actual = gitJsonMerge.mergeJson(oursStr, baseStr, theirsStr)
      assertEquals(JSON.parse(actual), JSON.parse(expectedStr))
    },
    sanitizeOps: false,
    sanitizeResources: false,
    sanitizeExit: false,
  }
}

interface IndentTestCase {
  ours: number
  base: number
  theirs: number
  expected: number
}

function createIndentTest(
  { ours, base, theirs, expected }: IndentTestCase,
): Deno.TestDefinition {
  return {
    name: `indent: ours=${ours} base=${base} theirs=${theirs}`,
    fn: () => {
      const actual = gitJsonMerge.selectIndent(ours, base, theirs)
      assertEquals(actual, expected)
    },
    sanitizeOps: false,
    sanitizeResources: false,
    sanitizeExit: false,
  }
}

interface StripBomTestCase {
  input: string
  expected: string
}

function createStripBomTest(
  { input, expected }: StripBomTestCase,
): Deno.TestDefinition {
  return {
    name: `stripBom: ${input.replace('\uFEFF', '<BOM>')}`,
    fn: () => {
      const actual = gitJsonMerge.stripBom(input)
      assertEquals(actual, expected)
    },
    sanitizeOps: false,
    sanitizeResources: false,
    sanitizeExit: false,
  }
}

// Test Data
const foo = { foo: 'foo' }
const bar = { bar: 'bar' }
const fooBar = { foo: 'foo', bar: 'bar' }

// Merge JSON Tests
Deno.test(
  createMergeJsonTest({ ours: foo, base: foo, theirs: foo, expected: foo }),
)
Deno.test(
  createMergeJsonTest({ ours: foo, base: foo, theirs: bar, expected: bar }),
)
Deno.test(
  createMergeJsonTest({
    ours: fooBar,
    base: foo,
    theirs: foo,
    expected: fooBar,
  }),
)
Deno.test(
  createMergeJsonTest({ ours: fooBar, base: foo, theirs: bar, expected: bar }),
)
Deno.test(
  createMergeJsonTest({ ours: bar, base: fooBar, theirs: bar, expected: bar }),
)
Deno.test(
  createMergeJsonTest({
    ours: bar,
    base: fooBar,
    theirs: fooBar,
    expected: bar,
  }),
)

// Indent Tests
Deno.test(createIndentTest({ ours: 4, base: 2, theirs: 2, expected: 4 }))
Deno.test(createIndentTest({ ours: 4, base: 4, theirs: 2, expected: 2 }))
Deno.test(createIndentTest({ ours: 4, base: 4, theirs: 4, expected: 4 }))
Deno.test(createIndentTest({ ours: 2, base: 4, theirs: 2, expected: 2 }))
Deno.test(createIndentTest({ ours: 2, base: 2, theirs: 4, expected: 4 }))
Deno.test(createIndentTest({ ours: 2, base: 4, theirs: 4, expected: 2 }))

// Strip BOM Tests
Deno.test(createStripBomTest({
  input: '[{"id":1,"field":"Foo"}]',
  expected: '[{"id":1,"field":"Foo"}]',
}))
Deno.test(createStripBomTest({
  input: '\uFEFF[{"id":1,"field":"Foo"}]',
  expected: '[{"id":1,"field":"Foo"}]',
}))
Deno.test(createStripBomTest({
  input: '[{"id":1,"field":"Foo"}]\uFEFF',
  expected: '[{"id":1,"field":"Foo"}]\uFEFF',
}))
Deno.test(createStripBomTest({
  input: '[{"id":1,\uFEFF"field":"Foo"}]',
  expected: '[{"id":1,\uFEFF"field":"Foo"}]',
}))
Deno.test(createStripBomTest({
  input: '\uFEFF[{"id":1,"field":"Foo"}]\uFEFF',
  expected: '[{"id":1,"field":"Foo"}]\uFEFF',
}))

// JSONC Tests with Comments
const jsonWithSingleLineComments = `{
  // This is a comment
  "foo": "foo"
}`

const jsonWithMultiLineComments = `{
  /* This is a
     multiline comment */
  "foo": "foo"
}`

const jsonWithInlineComments = `{
  "foo": "foo" // inline comment
}`

const jsonWithMixedComments = `{
  // Single line comment
  /* Multi line
     comment */
  "foo": "foo", // inline comment
  /* Another comment */
  "bar": "bar"
}`

Deno.test('merge with single line comments', () => {
  const actual = gitJsonMerge.mergeJson(
    jsonWithSingleLineComments,
    jsonWithSingleLineComments,
    jsonWithSingleLineComments,
  )
  assertEquals(JSON.parse(actual), foo)
})

Deno.test('merge with multi line comments', () => {
  const actual = gitJsonMerge.mergeJson(
    jsonWithMultiLineComments,
    jsonWithMultiLineComments,
    jsonWithMultiLineComments,
  )
  assertEquals(JSON.parse(actual), foo)
})

Deno.test('merge with inline comments', () => {
  const actual = gitJsonMerge.mergeJson(
    jsonWithInlineComments,
    jsonWithInlineComments,
    jsonWithInlineComments,
  )
  assertEquals(JSON.parse(actual), foo)
})

Deno.test('merge with mixed comments', () => {
  const actual = gitJsonMerge.mergeJson(
    jsonWithMixedComments,
    jsonWithMixedComments,
    jsonWithMixedComments,
  )
  assertEquals(JSON.parse(actual), fooBar)
})
