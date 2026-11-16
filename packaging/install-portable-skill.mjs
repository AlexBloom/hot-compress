// This file is copied to the root of the downloadable skill, beside SKILL.md.
import {cp,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import os from 'node:os';import path from 'node:path';
const source=fileURLToPath(new URL('.',import.meta.url));await stat(path.join(source,'SKILL.md'));
const target=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills','hot-compress');
if(path.resolve(source)===path.resolve(target)){console.log(`Skill is installed at ${target}`);process.exit(0);}
try{await stat(target);throw new Error(`A skill already exists at ${target}. Keep it, or move it aside before installing this package.`);}catch(err){if(err.code!=='ENOENT')throw err;}
await mkdir(path.dirname(target),{recursive:true});await cp(source,target,{recursive:true,errorOnExist:true,force:false});
console.log(`Installed ${target}. Start a new agent chat and use $hot-compress.`);
