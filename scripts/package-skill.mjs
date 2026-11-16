import {cp,mkdir,writeFile,rm,mkdtemp,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {copyEngine} from './package-engine.mjs';
await mkdir('release',{recursive:true});await mkdir('.hot-compress',{recursive:true});
const staging=await mkdtemp(path.resolve('.hot-compress/skill-package-'));
try{
 const target=path.join(staging,'hot-compress');await cp('skills/hot-compress',target,{recursive:true});
 await copyEngine(path.join(target,'resources','engine'));
 await cp('packaging/install-portable-skill.mjs',path.join(target,'install.mjs'));
 const zip=path.resolve('release','hot-compress-skill.zip');await rm(zip,{force:true});
 execFileSync('zip',['-q','-r',zip,'hot-compress'],{cwd:staging,stdio:'inherit'});
 const unpacked=path.resolve('release','hot-compress-skill');await rm(unpacked,{recursive:true,force:true});await rename(target,unpacked);
 console.log(`Created ${zip}. Built engine included; Node and system codecs required.`);
}finally{await rm(staging,{recursive:true,force:true});}
