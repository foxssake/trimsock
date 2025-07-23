import { join } from "node:path";
import { Glob } from "bun";

const root = join(import.meta.dir, "../");
const packagesRoot = join(root, "packages/");

interface Package {
  name: string;
  path: string;
}

function findPackages(): Package[] {
  const glob = new Glob("*");
  const packages = [...glob.scanSync({ cwd: packagesRoot, onlyFiles: false })];

  return [
    { name: "root", path: root },
    ...packages.map((pkg) => ({ name: pkg, path: join(packagesRoot, pkg) })),
  ];
}

async function checkVersions(): Promise<void> {
  const packages = findPackages();
  const versions = (
    await Promise.all(
      packages
        .map((pkg) => join(pkg.path, "/package.json"))
        .map((pkg) => Bun.file(pkg))
        .map((pkg) => pkg.json()),
    )
  ).map((pkg) => pkg.version);

  const uniqueVersions = [...new Set(versions)];
  const hasDifferentVersions = uniqueVersions.length > 1;

  if (hasDifferentVersions) {
    console.error("Found differing versions!");
    console.group("Packages:");
    packages.forEach((pkg, idx) =>
      console.log(`${pkg.name}:\t${versions[idx]}`),
    );
    console.groupEnd();

    process.exit(1);
  } else {
    console.log(versions[0]);
  }
}

async function bumpVersions(component: string): Promise<void> {
  const components = ["major", "minor", "patch"];
  const componentIdx = components.findIndex((it) => it === component);
  if (componentIdx < 0) {
    console.error("Unknown component:", component);
    process.exit(1);
  }

  for (const pkg of findPackages()) {
    const file = Bun.file(join(pkg.path, "package.json"));
    const json = await file.json();
    const version = (json.version as string).split(".").map((it) => ~~it);
    const newVersion = version.map((it, i) =>
      i === componentIdx ? it + 1 : i > componentIdx ? 0 : it,
    );

    json.version = newVersion.join(".");
    Bun.write(file, JSON.stringify(json, undefined, 2));
  }
}

async function main(args: string[]) {
  const action = args[2] ?? "check";
  const param = args[3] ?? "";

  if (action === "check") await checkVersions();
  else if (action === "bump") await bumpVersions(param);
  else console.error("Unknown command:", action);
}

main(process.argv);
