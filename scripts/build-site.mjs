import {cp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
const tag='v0.2.0-preview.1',release=`https://github.com/AlexBloom/hot-compress/releases/download/${tag}`;
await rm('site-dist',{recursive:true,force:true});await mkdir('site-dist/assets',{recursive:true});
const html=(await readFile('site/index.html','utf8')).replaceAll('{{MAC_URL}}',`${release}/Hot-Compress-macOS-arm64.zip`).replaceAll('{{SKILL_URL}}',`${release}/hot-compress-skill.zip`).replaceAll('{{TAG}}',tag);
if(html.includes('{{'))throw new Error('Unfilled website placeholders.');
await writeFile('site-dist/index.html',html);await cp('site/style.css','site-dist/style.css');await cp('web/src/assets/wordmark.svg','site-dist/assets/wordmark.svg');
await cp('site/assets/workbench.jpg','site-dist/assets/workbench.jpg');await writeFile('site-dist/.nojekyll','');
console.log('Built static download/setup site in site-dist/. No compression API is deployed to Pages.');
