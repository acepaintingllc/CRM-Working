import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

/**
 * Minimal ESM loader to transpile .ts files for node --test without relying on
 * the optional Node --experimental-strip-types flag.
 */
export async function load(url, context, defaultLoad) {
  if (url.startsWith('file://') && path.extname(fileURLToPath(url)) === '.ts') {
    const source = await readFile(fileURLToPath(url), 'utf8')

    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        allowImportingTsExtensions: true,
        jsx: ts.JsxEmit.Preserve,
        esModuleInterop: false,
      },
      fileName: fileURLToPath(url),
    })

    return {
      format: 'module',
      source: outputText,
      shortCircuit: true,
    }
  }

  return defaultLoad(url, context, defaultLoad)
}
