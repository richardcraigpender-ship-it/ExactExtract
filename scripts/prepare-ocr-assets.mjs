import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const outputRoot = join(projectRoot, 'src', 'renderer', 'public', 'ocr')
const nodeModules = join(projectRoot, 'node_modules')
const languages = ['eng', 'spa', 'fra', 'deu']

await mkdir(join(outputRoot, 'core'), { recursive: true })
await mkdir(join(outputRoot, 'tessdata'), { recursive: true })

await cp(
  join(nodeModules, 'tesseract.js', 'dist', 'worker.min.js'),
  join(outputRoot, 'worker.min.js')
)

const coreRoot = join(nodeModules, 'tesseract.js-core')
for (const fileName of await readdir(coreRoot)) {
  if (/^tesseract-core(?:-[a-z]+)*\.(?:wasm\.js|js|wasm)$/.test(fileName)) {
    await cp(join(coreRoot, fileName), join(outputRoot, 'core', fileName))
  }
}

for (const language of languages) {
  await cp(
    join(
      nodeModules,
      '@tesseract.js-data',
      language,
      '4.0.0_best_int',
      `${language}.traineddata.gz`
    ),
    join(outputRoot, 'tessdata', `${language}.traineddata.gz`)
  )
}

await writeFile(
  join(outputRoot, 'manifest.json'),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      tesseractVersion: '7.0.0',
      languagePackageVersion: '1.0.0',
      worker: 'worker.min.js',
      core: 'core',
      languages: Object.fromEntries(
        languages.map((language) => [language, `tessdata/${language}.traineddata.gz`])
      )
    },
    null,
    2
  )}\n`
)

console.log(`Prepared offline OCR assets for ${languages.join(', ')}.`)
