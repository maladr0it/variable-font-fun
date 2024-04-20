import { copy, emptyDir } from "https://deno.land/std@0.212.0/fs/mod.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.19.11/mod.js";

const SOURCE_DIR = "src";
const BUILD_DIR = "build";

export const build = async () => {
  await emptyDir(`${BUILD_DIR}`);

  await esbuild.build({
    entryPoints: [`${SOURCE_DIR}/main.ts`],
    outfile: `${BUILD_DIR}/bundle.js`,
    bundle: true,
    sourcemap: true,
  });

  esbuild.stop();

  await copy(`${SOURCE_DIR}/static`, `${BUILD_DIR}`, {
    overwrite: true,
  });
};
