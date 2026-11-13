#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { compress, doctor } from './engine.ts';
import { serve } from './server.ts';
const help = `Hot Compress — drop less weight, keep the detail.

  hot-compress <file-or-folder> [...]   Optimize a batch; preserve originals
  hot-compress gui                     Open the local web interface
  hot-compress doctor                  Check installed codecs

  --format webp|avif                   Opaque images only; alpha stays PNG
  --preset balanced|smaller|quality    Default: balanced
  --responsive                        Export image widths + HTML srcset
  --widths 480,768,1280,1920            Custom responsive widths
  --sizes '(max-width: 768px) 100vw, 1280px'
  --max-width 2560                     Maximum long edge; never upscale
  --output ./optimized                Each run gets its own batch folder
  --json                              Machine-readable report
  --port 4318                         Local GUI port

Requires ImageMagick (7 preferred; 6 supported); video also requires FFmpeg. Run doctor for diagnostics.
`;
try {
  const {values,positionals} = parseArgs({allowPositionals:true,options:{
    help:{type:'boolean',short:'h'},format:{type:'string'},preset:{type:'string'},responsive:{type:'boolean'},widths:{type:'string'},sizes:{type:'string'},'max-width':{type:'string'},output:{type:'string'},json:{type:'boolean'},port:{type:'string'}
  }});
  if (values.help || !positionals.length) console.log(help);
  else if (positionals[0] === 'gui') await serve(Number(values.port || 4318));
  else if (positionals[0] === 'doctor') {
    const checks = await doctor(); console.log(values.json ? JSON.stringify(checks) : checks.map(c=>`${c.available?'✓':'✗'} ${c.tool}: ${c.detail}`).join('\n'));
    if (checks.some(c=>!c.available)) process.exitCode = 1;
  } else {
    const report = await compress(positionals,{
      format:values.format as 'webp'|'avif'|undefined,preset:values.preset as 'balanced'|'smaller'|'quality'|undefined,
      responsive:values.responsive,widths:values.widths?.split(',').map(Number),sizes:values.sizes,maxWidth:values['max-width'] === undefined ? undefined : Number(values['max-width']),output:values.output
    }, values.json ? undefined : (a,i,n)=>console.log(`[${i}/${n}] ${a.status}: ${a.source}${a.reason ? ` — ${a.reason}` : ''}`));
    console.log(values.json ? JSON.stringify(report,null,2) : `\nResults: ${report.directory}\n${report.assets.filter(a=>a.status==='done').length} optimized · ${(report.inputBytes/1e6).toFixed(2)} MB → ${(report.outputBytes/1e6).toFixed(2)} MB${report.savedBytes < 0 ? ' (output grew; review before use)' : ''}\nReport and HTML snippets included.`);
    if (report.assets.some(a=>a.status !== 'done')) process.exitCode = 1;
  }
} catch (err) { console.error((err as Error).message); process.exitCode = 1; }
