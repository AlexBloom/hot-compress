import {cp,mkdir,writeFile,readFile,rm,mkdtemp,rename,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {copyEngine} from './package-engine.mjs';
if(process.platform!=='darwin')throw new Error('Build the Mac package on macOS.');
const arch=process.arch;if(!['arm64','x64'].includes(arch))throw new Error('Unsupported architecture.');
const target=arch==='arm64'?'arm64-apple-macos14.0':'x86_64-apple-macos14.0';
await mkdir('release',{recursive:true});await mkdir('.hot-compress',{recursive:true});
const staging=await mkdtemp(path.resolve('.hot-compress/mac-package-'));
const app=path.join(staging,'Hot Compress.app'),contents=path.join(app,'Contents'),resources=path.join(contents,'Resources');
try{
 await mkdir(path.join(contents,'MacOS'),{recursive:true});await mkdir(path.join(resources,'runtime'),{recursive:true});
 await copyEngine(path.join(resources,'engine'));await cp(process.execPath,path.join(resources,'runtime','node'));
 const version=process.version;const licenseURL=`https://raw.githubusercontent.com/nodejs/node/${version}/LICENSE`;
 const license=await fetch(licenseURL);if(!license.ok)throw new Error(`Node license download failed: ${license.status}`);
 await writeFile(path.join(resources,'runtime','LICENSE'),await license.text());
 await writeFile(path.join(resources,'runtime','VERSION'),`${version}\n${licenseURL}\n`);
 await cp('macos/Info.plist',path.join(contents,'Info.plist'));
 execFileSync('swiftc',['-swift-version','5','-O','-target',target,'macos/HotCompress.swift','-o',path.join(contents,'MacOS','HotCompress'),'-framework','AppKit','-framework','WebKit','-module-cache-path',path.join(staging,'module-cache')],{stdio:'inherit'});
 for(const item of [path.join(resources,'runtime','node'),path.join(contents,'MacOS','HotCompress'),app])execFileSync('codesign',['--force','--sign','-','--timestamp=none',item],{stdio:'inherit'});
 execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
 const output=path.resolve('release','Hot Compress.app');
 try {const info=await readFile(path.join(output,'Contents','Info.plist'),'utf8');if(!info.includes('design.alexbloom.hot-compress'))throw new Error('Refusing to replace an unrelated app.');await rm(output,{recursive:true});}catch(err){if(err.code!=='ENOENT')throw err;}
 await rename(app,output);
 const zip=path.resolve('release',`Hot-Compress-macOS-${arch==='x64'?'x86_64':'arm64'}.zip`);await rm(zip,{force:true});
 execFileSync('ditto',['-c','-k','--sequesterRsrc','--keepParent',output,zip],{stdio:'inherit'});
 console.log(`Created ${zip} (${((await stat(zip)).size/1e6).toFixed(1)} MB). Ad-hoc signed developer build; not notarized. System codecs required.`);
}finally{await rm(staging,{recursive:true,force:true});}
