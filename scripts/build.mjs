import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises'
import { validateSnapshot } from '../lib/typhoon.js'

const root = new URL('../', import.meta.url)
validateSnapshot(JSON.parse(await readFile(new URL('data/latest.json', root), 'utf8')))
// 明确列出发布文件，避免将 .git、测试样本、工作流或研究材料打包到公开站点。
const files = ['index.html', 'styles.css', 'app.js', 'lib/typhoon.js', 'data/latest.json']
for (const file of files) {
  const target = new URL(`_site/${file}`, root)
  await mkdir(new URL('.', target), { recursive: true })
  await copyFile(new URL(file, root), target)
}
await writeFile(new URL('_site/.nojekyll', root), '')
console.log(`已生成 GitHub Pages 静态目录 _site，共 ${files.length} 个文件。`)
