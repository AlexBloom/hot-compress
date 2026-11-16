import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
export async function copyEngine(target){
 await mkdir(target,{recursive:true});
 for(const directory of ['dist','bin','web-dist','docs'])await cp(directory,path.join(target,directory),{recursive:true});
 for(const file of ['README.md','LICENSE'])await cp(file,path.join(target,file));
 const pkg=JSON.parse(await readFile('package.json','utf8'));
 await writeFile(path.join(target,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,type:'module'},null,2)+'\n');
}
