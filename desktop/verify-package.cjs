"use strict";

const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const walk = require("acorn-walk");
const REQUIRED_RENDERER_ASSETS = [
  "renderer/index.html",
  "renderer/app.js",
  "renderer/style.css",
];

function toPosix(filePath) {
  return filePath.replaceAll("\\", "/");
}

function staticString(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = staticString(node.left);
    const right = staticString(node.right);
    return left === null || right === null ? null : left + right;
  }
  return null;
}

function extractStaticModuleSpecifiers(source, filename = "<source>") {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const specifiers = new Set();
  function add(node, kind) {
    const value = staticString(node);
    if (value === null) {
      throw new Error(`Non-static ${kind} module specifier in ${filename} cannot be packaged safely`);
    }
    specifiers.add(value);
  }
  walk.simple(ast, {
    CallExpression(node) {
      if (node.callee.type === "Identifier" && node.callee.name === "require") {
        if (node.arguments.length !== 1) {
          throw new Error(`Invalid require() arity in ${filename}`);
        }
        add(node.arguments[0], "require");
      }
      if (
        node.callee.type === "MemberExpression" &&
        !node.callee.computed &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "require" &&
        node.callee.property.type === "Identifier" &&
        node.callee.property.name === "resolve"
      ) {
        if (node.arguments.length !== 1) {
          throw new Error(`Invalid require.resolve() arity in ${filename}`);
        }
        add(node.arguments[0], "require.resolve");
      }
    },
    ImportExpression(node) {
      add(node.source, "import");
    },
    ImportDeclaration(node) {
      add(node.source, "import");
    },
    ExportNamedDeclaration(node) {
      if (node.source) add(node.source, "export");
    },
    ExportAllDeclaration(node) {
      add(node.source, "export");
    },
  });
  return [...specifiers];
}

function resolveLocalModule(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.cjs`,
    `${base}.mjs`,
    `${base}.json`,
    path.join(base, "index.js"),
    path.join(base, "index.cjs"),
    path.join(base, "index.mjs"),
  ];
  const resolved = candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
  if (!resolved) {
    throw new Error(`Local dependency ${specifier} required by ${fromFile} does not exist`);
  }
  return resolved;
}

function collectLocalDependencyClosure(sourceRoot, entryFiles) {
  const root = path.resolve(sourceRoot);
  const queue = entryFiles.map((entry) => path.resolve(root, entry));
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    const relative = path.relative(root, current);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Local dependency escapes desktop source root: ${current}`);
    }
    const normalized = toPosix(relative);
    if (visited.has(normalized)) continue;
    if (!fs.existsSync(current)) throw new Error(`Desktop entry file is missing: ${current}`);
    visited.add(normalized);

    if (!/\.(?:c|m)?js$/i.test(current)) continue;
    const source = fs.readFileSync(current, "utf8");
    for (const specifier of extractStaticModuleSpecifiers(source, current)) {
      if (specifier.startsWith(".")) queue.push(resolveLocalModule(current, specifier));
    }
  }

  return [...visited].sort();
}

function findFilesNamed(root, filename) {
  const matches = [];
  if (!fs.existsSync(root)) return matches;
  const stack = [path.resolve(root)];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(child);
      else if (entry.isFile() && entry.name === filename) matches.push(child);
    }
  }
  return matches.sort();
}

function findPackageArchives(releaseDir) {
  const root = path.resolve(releaseDir);
  return findFilesNamed(root, "app.asar").filter((archive) => {
    const segments = path.relative(root, archive).split(path.sep);
    return !segments.some((segment) => /(?:^|[-_])(stale|quarantine)(?:[-_]|$)/i.test(segment));
  });
}

function normalizeArchiveEntry(entry) {
  const normalized = toPosix(entry).replace(/^\/+/, "");
  return `/${normalized}`;
}

function missingArchiveEntries(archiveEntries, expectedEntries) {
  const available = new Set(archiveEntries.map(normalizeArchiveEntry));
  return expectedEntries
    .map(normalizeArchiveEntry)
    .filter((entry) => !available.has(entry));
}

function verifyArchive(asarPath, sourceRoot) {
  const asar = require("@electron/asar");
  const entries = new Set(asar.listPackage(asarPath).map(normalizeArchiveEntry));
  const packageJson = JSON.parse(asar.extractFile(asarPath, "package.json").toString("utf8"));
  const mainEntry = packageJson.main || "main.js";
  const localModules = collectLocalDependencyClosure(sourceRoot, [mainEntry, "preload.js"]);
  const expected = [...new Set([...localModules, ...REQUIRED_RENDERER_ASSETS])]
    .map(normalizeArchiveEntry)
    .sort();
  const missing = missingArchiveEntries([...entries], expected);
  if (missing.length > 0) {
    throw new Error(`${asarPath} is missing packaged runtime files: ${missing.join(", ")}`);
  }

  const mismatched = expected.filter((entry) => {
    const relative = entry.replace(/^\//, "");
    const sourcePath = path.join(sourceRoot, ...relative.split("/"));
    const source = fs.readFileSync(sourcePath);
    const packaged = asar.extractFile(asarPath, relative);
    return !source.equals(packaged);
  });
  if (mismatched.length > 0) {
    throw new Error(`${asarPath} contains stale runtime files: ${mismatched.join(", ")}`);
  }

  const bridgePath = path.join(path.dirname(asarPath), "bridge-bundle.mjs");
  if (!fs.existsSync(bridgePath) || fs.statSync(bridgePath).size === 0) {
    throw new Error(`${asarPath} has no non-empty bridge-bundle.mjs beside app.asar`);
  }
  const sourceBridgePath = path.join(sourceRoot, "bridge-bundle.mjs");
  if (!fs.existsSync(sourceBridgePath)) {
    throw new Error(`Source bridge bundle is missing: ${sourceBridgePath}`);
  }
  if (!fs.readFileSync(sourceBridgePath).equals(fs.readFileSync(bridgePath))) {
    throw new Error(`${bridgePath} does not match the current source bridge bundle`);
  }

  return { asarPath, bridgePath, localModules, expected };
}

function main() {
  const releaseIndex = process.argv.indexOf("--release-dir");
  const releaseDir = path.resolve(
    releaseIndex >= 0 ? process.argv[releaseIndex + 1] : path.join(__dirname, "release"),
  );
  const archives = findPackageArchives(releaseDir);
  if (archives.length === 0) {
    throw new Error(`No packaged app.asar found under ${releaseDir}`);
  }

  for (const archive of archives) {
    const result = verifyArchive(archive, __dirname);
    process.stdout.write(
      `PASS ${archive}: ${result.localModules.length} local main-process modules and ` +
        `${result.expected.length} runtime files verified; bridge present.\n`,
    );
  }
}

module.exports = {
  collectLocalDependencyClosure,
  extractStaticModuleSpecifiers,
  findFilesNamed,
  findPackageArchives,
  missingArchiveEntries,
  normalizeArchiveEntry,
  resolveLocalModule,
  verifyArchive,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Package verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
