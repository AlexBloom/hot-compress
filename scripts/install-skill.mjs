import {cp,mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../',import.meta.url));
const root=process.env.CODEX_HOME || path.join(os.homedir(),'.codex');
const target=path.join(root,'skills','hot-compress');
try {await stat(target);throw new Error(`Skill already exists at ${target}; inspect it before replacing.`);}catch(err){if(err.code!=='ENOENT')throw err;}
await mkdir(path.dirname(target),{recursive:true});
await cp(path.join(repo,'skills','hot-compress'),target,{recursive:true,errorOnExist:true,force:false});
await writeFile(path.join(target,'engine-path'),repo.trim());
console.log(`Installed ${target}. Start a new Codex chat to discover $hot-compress.`);
