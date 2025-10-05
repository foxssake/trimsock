import { join } from "node:path";
import { Glob } from "bun";

export const root = join(import.meta.dir, "../");
export const packagesRoot = join(root, "packages/");

export interface Package {
  name: string;
  path: string;
}

export function findPackages(): Package[] {
  const glob = new Glob("*");
  const packages = [...glob.scanSync({ cwd: packagesRoot, onlyFiles: false })];

  return [
    { name: "root", path: root },
    ...packages.map((pkg) => ({ name: pkg, path: join(packagesRoot, pkg) })),
  ];
}

