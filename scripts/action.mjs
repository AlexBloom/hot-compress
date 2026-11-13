import {compress} from '../dist/engine.js';
import {appendFile} from 'node:fs/promises';
const report=await compress((process.env.HOT_INPUTS||'').split('\n').map(p=>p.trim()).filter(Boolean),{
 output:process.env.HOT_OUTPUT||'optimized',format:process.env.HOT_FORMAT||'webp',preset:process.env.HOT_PRESET||'balanced',responsive:process.env.HOT_RESPONSIVE==='true'
});
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`directory=${report.directory}\n`);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### Hot Compress\n\n${report.assets.filter(a=>a.status==='done').length} optimized. ${(report.inputBytes/1e6).toFixed(2)} MB input → ${(report.outputBytes/1e6).toFixed(2)} MB output (all variants).\n\n${report.assets.filter(a=>a.status!=='done').length} files need review. Download the report artifact for details.\n`);
if(report.assets.some(a=>a.status!=='done'))process.exitCode=1;
