import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

const outDir = await mkdtemp(resolve(tmpdir(), 'rootcellar-tests-'))
try {
    for (const name of ['workSegment', 'workStorage', 'workFlow']) {
        await build({
            configFile: false,
            logLevel: 'warn',
            resolve: {
                alias: {
                    'vite-plugin-monkey/dist/client': resolve('tests/gm.mock.ts'),
                    ...(name === 'workFlow'
                        ? {
                                '../api': resolve('tests/workFlow.mock.ts'),
                                '../page': resolve('tests/workFlow.mock.ts'),
                                '../utils/download': resolve('tests/workFlow.mock.ts'),
                            }
                        : {}),
                },
            },
            ssr: { noExternal: true },
            build: {
                ssr: resolve(`tests/${name}.smoke.ts`),
                target: 'node20',
                outDir,
                emptyOutDir: false,
                minify: false,
                rollupOptions: { output: { entryFileNames: `${name}.mjs` } },
            },
        })
        await import(pathToFileURL(resolve(outDir, `${name}.mjs`)).href)
    }
}
finally {
    await rm(outDir, { recursive: true, force: true })
}
