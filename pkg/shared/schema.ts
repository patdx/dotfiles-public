/**
 * Valibot schemas for the declarative package catalog.
 * Source of truth for both runtime validation and generated JSON Schema.
 */
import * as v from 'valibot'
import { toJsonSchema } from '@valibot/to-json-schema'

/** Highest document `version` this CLI understands. */
export const MAX_DOCUMENT_VERSION = 1

export const DEFAULT_REMOTE_REPO = 'https://repo.pmil.me'

/** Path prefix under a repo base URL where catalog JSON is published. */
export const CATALOG_API_PREFIX = 'api'

export const PACKAGE_SCHEMA_URL =
  'https://repo.pmil.me/api/schema/v1/pkg.json'
export const REPO_SCHEMA_URL = 'https://repo.pmil.me/api/schema/v1/repo.json'

export interface FileOptions {
  url: string
  filename?: string
  type?: 'zip' | 'targz' | 'raw'
  executable?: boolean
  url_provider?: string
}

export interface ShortcutOptions {
  name?: string
  icon?: string
}

export interface PackageDocument {
  $schema?: string
  version?: number
  name: string
  binary_name?: string
  files: FileOptions[]
  shortcut?: ShortcutOptions
  post_install_message?: string
}

export interface RepoListing {
  $schema?: string
  version?: number
  packages: string[]
  min_cli_version?: string
}

const FileOptionsSchema: v.GenericSchema<FileOptions> = v.object({
  url: v.string(),
  filename: v.optional(v.string()),
  type: v.optional(v.picklist(['zip', 'targz', 'raw'] as const)),
  executable: v.optional(v.boolean()),
  url_provider: v.optional(v.string()),
})

const ShortcutSchema: v.GenericSchema<ShortcutOptions> = v.object({
  name: v.optional(v.string()),
  icon: v.optional(v.string()),
})

const PackageDocumentSchema: v.GenericSchema<PackageDocument> = v.object({
  $schema: v.optional(v.string()),
  version: v.optional(v.number()),
  name: v.string(),
  binary_name: v.optional(v.string()),
  files: v.array(FileOptionsSchema),
  shortcut: v.optional(ShortcutSchema),
  post_install_message: v.optional(v.string()),
})

const RepoListingSchema: v.GenericSchema<RepoListing> = v.object({
  $schema: v.optional(v.string()),
  version: v.optional(v.number()),
  packages: v.array(v.string()),
  min_cli_version: v.optional(v.string()),
})

/** Runtime install shape (catalog document minus identity / schema metadata). */
export interface InstallOptions {
  files: FileOptions[]
  binary_name?: string
  /** Installed package version string (not document format version). */
  version?: string
  shortcut?: ShortcutOptions
  post_install_message?: string
}

export function documentVersion(doc: { version?: number }): number {
  return doc.version ?? 1
}

export function assertSupportedDocumentVersion(
  doc: { version?: number },
  kind: 'package' | 'repo',
): number {
  const version = documentVersion(doc)
  if (version > MAX_DOCUMENT_VERSION) {
    throw new Error(
      `Unsupported ${kind} document version ${version}. ` +
        `This CLI supports up to ${MAX_DOCUMENT_VERSION}. ` +
        `Update @patdx/pkg to use this repo.`,
    )
  }
  return version
}

export function parsePackageDocument(data: unknown): PackageDocument {
  const doc = v.parse(PackageDocumentSchema, data)
  assertSupportedDocumentVersion(doc, 'package')
  return doc
}

export function parseRepoListing(data: unknown): RepoListing {
  const doc = v.parse(RepoListingSchema, data)
  assertSupportedDocumentVersion(doc, 'repo')
  return doc
}

export function installOptionsFromDocument(
  doc: PackageDocument,
): InstallOptions {
  return {
    files: doc.files,
    binary_name: doc.binary_name ?? doc.name,
    shortcut: doc.shortcut,
    post_install_message: doc.post_install_message,
  }
}

/** Generate JSON Schema objects from the Valibot source of truth. */
export function generateCatalogJsonSchemas(): {
  package: Record<string, unknown>
  repo: Record<string, unknown>
} {
  return {
    package: toJsonSchema(PackageDocumentSchema, {
      target: 'draft-07',
    }) as Record<string, unknown>,
    repo: toJsonSchema(RepoListingSchema, {
      target: 'draft-07',
    }) as Record<string, unknown>,
  }
}
