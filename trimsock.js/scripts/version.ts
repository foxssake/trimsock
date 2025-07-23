import { join } from 'path'
import { Glob } from 'bun'

const root = join(import.meta.dir, '../')
const packagesRoot = join(root, 'packages/')

function findPackages(): string[] {
  const glob = new Glob('*');
  return [...glob.scanSync({ cwd: packagesRoot, onlyFiles: false })]
}

async function checkVersions(): Promise<void> {
  const packages = findPackages()
  const versions = (await Promise.all(packages
    .map(pkg => join(packagesRoot, pkg, '/package.json'))
    .map(pkg => Bun.file(pkg))
    .map(pkg => pkg.json())
  )).map(pkg => pkg.version)

  const uniqueVersions = [...new Set(versions)]
  const hasDifferentVersions = uniqueVersions.length > 1

  if (hasDifferentVersions) {
    console.error("Found differing versions!")
    console.group("Packages:")
    packages.forEach((pkg, idx) => console.log(`${pkg}:\t${versions[idx]}`))
    console.groupEnd()

    process.exit(1)
  } else {
    console.log(versions[0])
  }
}

async function bumpVersions(component: string): Promise<void> {
  const components = ['major', 'minor', 'patch']
  const componentIdx = components.findIndex(it => it === component)
  if (componentIdx < 0) {
    console.error("Unknown component:", component)
    process.exit(1)
  }

  for (const pkg of findPackages()) {
    const file = Bun.file(join(packagesRoot, pkg, 'package.json'))
    const json = await file.json()
    const version = (json.version as string).split('.').map(it => ~~it)
    const newVersion = version.map((it, i) => (i === componentIdx) ? it + 1 : (i > componentIdx) ? 0 : it)

    json.version = newVersion.join('.')
    file.write(JSON.stringify(json, undefined, 2))
  }
}

function main(args: string[]) {
  const action = args[2] ?? 'check'
  const param = args[3] ?? ''

  if (action === 'check')
    checkVersions()
  else if (action === 'bump')
    bumpVersions(param)
  else
    console.error('Unknown command:', action)
}

main(process.argv)
