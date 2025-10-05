#!/bin/env bun

import { findPackages, root } from "./shared";
import { $ } from "bun";

async function main(args: string[]) {
  const otp = args[2];
  if (!otp) {
    console.error("No OTP provided for publishing!")
    process.exit(1)
  }

  console.log("Building project...")
  await $`bun run build`.cwd(root)

  const packages = findPackages()
  for (const pkg of packages) {
    if (pkg.name == "root")
      continue

    console.log(`Publishing package ${pkg.name}...`)
    await $`npm publish --access public --otp ${otp}`.cwd(pkg.path)
  }
}

main(process.argv)
