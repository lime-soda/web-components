import { readFile } from 'node:fs/promises'
import { glob } from 'glob'
import { dirname, resolve } from 'node:path'

// Get configuration from environment variables with defaults
const workspaceRoot = resolve(
  process.cwd(),
  process.env.WORKSPACE_ROOT || '../../',
)
const customElementsManifestGlob =
  process.env.CUSTOM_ELEMENTS_MANIFEST_GLOB || 'packages/*/custom-elements.json'

export async function findPackageDirectories(): Promise<string[]> {
  const packagePaths = await glob('packages/*/', { cwd: workspaceRoot })
  return packagePaths.map((path) => resolve(workspaceRoot, path))
}

export async function findCustomElementsManifests(): Promise<
  Array<{ packagePath: string; manifestPath: string }>
> {
  const results: Array<{ packagePath: string; manifestPath: string }> = []

  const manifestPaths = await glob(customElementsManifestGlob, {
    cwd: workspaceRoot,
  })

  for (const manifestPath of manifestPaths) {
    const fullManifestPath = resolve(workspaceRoot, manifestPath)
    const packagePath = dirname(fullManifestPath)
    results.push({ packagePath, manifestPath: fullManifestPath })
  }

  return results
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    console.error(`Failed to read JSON file ${filePath}:`, error)
    return null
  }
}

export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch (error) {
    console.error(`Failed to read text file ${filePath}:`, error)
    return null
  }
}

export function getTokensPath(): string {
  const tokensPath = process.env.TOKENS_PATH || 'support/tokens'
  return resolve(workspaceRoot, tokensPath)
}

export function getWorkspaceRoot(): string {
  return workspaceRoot
}
