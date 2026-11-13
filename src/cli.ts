#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { compress, doctor, type Options } from './engine.ts';
import { serve } from './server.ts';
const help = `Hot Compress — prepare images, camera RAW and video.

  hot-compress <file-or-folder> [...]   Batch conversion; preserve originals
  hot-compress gui                     Open the local interface
  hot-compress doctor                  Check codec tools

  --destination web|app|instagram|facebook|tiktok|youtube|x|sharing
  --format auto|preserve|webp|avif|jpeg|png|tiff|heic|jxl
  --video-format auto|preserve|h264|hevc|vp9|av1
  --preset balanced|smaller|quality    Destination default / smaller / higher quality
  --quality 1..100                    Optional image quality override
  --lossless                          WebP/JXL lossless prepared pixels
  --png-level 0..9                    PNG DEFLATE effort (default 9)
  --tiff-compression zip|lzw|jpeg|none
  --jpeg-chroma 420|444
  --video-crf 0..51                   Lower usually means larger/clearer
  --frame-rate source|30|60           Retain source, or cap frame rate
  --raw-white-balance camera|auto
  --resize original|fit               Otherwise use destination dimensions
  --max-width 2560                    Optional maximum long edge; never upscale
  --responsive                        Image widths + HTML srcset
  --widths 480,768,1280,1920
  --sizes '(max-width: 768px) 100vw, 1280px'
  --output ./optimized                Each run gets a separate batch folder
  --json                              Machine-readable report
  --port 4318                         Local GUI port

Requires ImageMagick, LibRaw for camera RAW, FFmpeg for video, zip for GUI archives.
Transparency stays PNG. Preserve-format re-encodes; RAW renders to TIFF.
`;
try {
 const stringNames=['destination','format','video-format','preset','quality','png-level','tiff-compression','jpeg-chroma','video-crf','frame-rate','raw-white-balance','resize','max-width','widths','sizes','output','port'];
 const {values,positionals}=parseArgs({allowPositionals:true,options:{...Object.fromEntries(stringNames.map(key=>[key,{type:'string' as const}])),help:{type:'boolean',short:'h'},responsive:{type:'boolean'},lossless:{type:'boolean'},json:{type:'boolean'}}});
 const str=(key:string)=>(values as Record<string,unknown>)[key] as string|undefined;
 const num=(key:string)=>str(key)===undefined?undefined:Number(str(key));
 if(values.help||!positionals.length)console.log(help);
 else if(positionals[0]==='gui')await serve(Number(str('port')||4318));
 else if(positionals[0]==='doctor'){
  const checks=await doctor();console.log(values.json?JSON.stringify(checks):checks.map(c=>`${c.available?'✓':'✗'} ${c.tool}: ${c.detail}`).join('\n'));if(checks.some(c=>!c.available))process.exitCode=1;
 }else{
  const options={destination:str('destination'),format:str('format'),videoFormat:str('video-format'),preset:str('preset'),quality:num('quality'),lossless:values.lossless,pngLevel:num('png-level'),tiffCompression:str('tiff-compression'),jpegChroma:str('jpeg-chroma'),videoCrf:num('video-crf'),frameRate:str('frame-rate')==='source'?'source':num('frame-rate'),resize:str('resize'),rawWhiteBalance:str('raw-white-balance'),responsive:values.responsive,widths:str('widths')?.split(',').map(Number),sizes:str('sizes'),maxWidth:num('max-width'),output:str('output')} as Options;
  const report=await compress(positionals,options,values.json?undefined:(a,i,n)=>{console.log(`[${i}/${n}] ${a.status}: ${a.source}${a.reason?` — ${a.reason}`:''}`);for(const warning of a.warnings||[])console.log(`  Note: ${warning}`);});
  console.log(values.json?JSON.stringify(report,null,2):`\nResults: ${report.directory}\n${report.assets.filter(a=>a.status==='done').length} optimized · ${(report.inputBytes/1e6).toFixed(2)} MB → ${(report.outputBytes/1e6).toFixed(2)} MB${report.savedBytes<0?' (output grew; review before use)':''}\nReport and HTML snippets included.`);
  if(report.assets.some(a=>a.status!=='done'))process.exitCode=1;
 }
}catch(err){console.error((err as Error).message);process.exitCode=1;}
