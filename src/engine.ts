import { spawn } from 'node:child_process';
import { mkdir, readdir, lstat, stat, writeFile, readFile, copyFile, mkdtemp, rm, realpath, open, access } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { profileFor, destinations, type Destination, type ImageFormat, type VideoFormat } from './guidance.ts';

export type Options = {
  destination?: Destination; format?: ImageFormat; videoFormat?: VideoFormat;
  preset?: 'balanced' | 'smaller' | 'quality'; quality?: number; lossless?: boolean;
  pngLevel?: number; tiffCompression?: 'zip'|'lzw'|'jpeg'|'none'; jpegChroma?: '420'|'444';
  videoCrf?: number; frameRate?: 'source'|30|60; resize?: 'fit'|'original';
  rawWhiteBalance?: 'camera'|'auto'; responsive?: boolean; widths?: number[]; sizes?: string; maxWidth?: number; output?: string;
};
export type Asset = { source: string; status: 'done' | 'error' | 'skipped'; reason?: string; warnings?: string[]; inputBytes: number; outputs: { file: string; bytes: number; width: number; height: number }[]; html?: string; recommendation?: string };
export type Report = { version: number; directory: string; assets: Asset[]; inputBytes: number; outputBytes: number; savedBytes: number; options: Options };
export const rawFormats = new Set(['.cr2','.cr3','.crw','.nef','.nrw','.arw','.srf','.sr2','.dng','.raf','.rw2','.orf','.pef','.ptx','.srw','.rwl','.3fr','.fff','.iiq','.kdc','.dcr','.mos','.mrw','.x3f']);
export const images = new Set(['.jpg','.jpeg','.png','.tif','.tiff','.heic','.heif','.hif','.webp','.avif','.bmp','.gif','.jxl','.jpe','.jfif']);
export const videos = new Set(['.mp4','.mov','.m4v','.webm','.mkv','.avi','.mts','.m2ts']);
const ignored = new Set(['.git','node_modules','.hot-compress','dist','web-dist']);
async function run(bin: string, args: string[], timeout = 120000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore','pipe','pipe'] });
    let stdout = '', stderr = ''; let settled = false;
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error(`${bin} exceeded ${Math.round(timeout/1000)} seconds`)); }, timeout);
    proc.stdout.on('data', b => { stdout += b; if (stdout.length > 4_000_000) proc.kill('SIGKILL'); });
    proc.stderr.on('data', b => { stderr = (stderr + b).slice(-6000); });
    proc.on('error', err => { clearTimeout(timer); settled = true; reject(new Error(`${bin}: ${err.message}. Run hot-compress doctor.`, {cause:err})); });
    proc.on('close', code => { clearTimeout(timer); if (!settled) code === 0 ? resolve(stdout.trim()) : reject(new Error(`${bin}: ${stderr.trim() || `exit ${code}`}`)); });
  });
}
export async function command(bin: string, args: string[], timeout = 120000): Promise<string> {
  try { return await run(bin,args,timeout); }
  catch (err) {
    if (bin === 'magick' && (err as Error & {cause?: {code?: string}}).cause?.code === 'ENOENT') {
      return run(args[0] === 'identify' ? 'identify' : 'convert',args[0] === 'identify' ? args.slice(1) : args,timeout);
    }
    throw err;
  }
}
export function validateOptions(options: Options): Options {
  if (options.destination !== undefined && !destinations.some(p=>p.id===options.destination)) throw new Error('Unknown destination.');
  if (options.format !== undefined && !['auto','preserve','webp','avif','jpeg','png','tiff','heic','jxl'].includes(options.format)) throw new Error('Unsupported image format.');
  if (options.videoFormat !== undefined && !['auto','preserve','h264','hevc','vp9','av1'].includes(options.videoFormat)) throw new Error('Unsupported video codec.');
  if (options.preset !== undefined && !['balanced','smaller','quality'].includes(options.preset)) throw new Error('Preset must be balanced, smaller, or quality.');
  const enums = {tiffCompression:['zip','lzw','jpeg','none'],jpegChroma:['420','444'],frameRate:['source',30,60],resize:['fit','original'],rawWhiteBalance:['camera','auto']} as const;
  for(const [key,values] of Object.entries(enums)) if(options[key as keyof Options] !== undefined && !(values as readonly unknown[]).includes(options[key as keyof Options])) throw new Error(`Invalid ${key}.`);
  for(const key of ['responsive','lossless'] as const) if(options[key] !== undefined && typeof options[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
  for(const [key,min,max] of [['quality',1,100],['pngLevel',0,9],['videoCrf',0,51],['maxWidth',16,16384]] as const) {
    const value=options[key]; if(value !== undefined && (!Number.isInteger(value)||value<min||value>max)) throw new Error(`${key} must be an integer from ${min} to ${max}.`);
  }
  if (options.widths !== undefined && (!Array.isArray(options.widths) || !options.widths.length || options.widths.length > 12 || options.widths.some(w => !Number.isInteger(w) || w < 16 || w > 16384))) throw new Error('Use 1–12 widths between 16 and 16384.');
  if (options.sizes !== undefined && (typeof options.sizes !== 'string' || options.sizes.length > 2000)) throw new Error('Invalid sizes attribute.');
  if (options.output !== undefined && (typeof options.output !== 'string'||!options.output.trim()||/[\x00-\x1f]/.test(options.output))) throw new Error('Invalid output directory.');
  return options;
}
export async function discover(inputs: string[], output: string): Promise<string[]> {
  const found = new Set<string>();
  const excludeOutput=!inputs.some(input=>path.resolve(input)===output||path.resolve(input).startsWith(output+path.sep));
  async function walk(entry: string, explicit = false) {
    const absolute = path.resolve(entry);
    if (excludeOutput && (absolute === output || absolute.startsWith(output + path.sep))) return;
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) return;
    if (info.isDirectory()) {
      if (!explicit && (ignored.has(path.basename(absolute)) || path.basename(absolute).startsWith('.'))) return;
      try { await stat(path.join(absolute, '.hot-compress-output')); return; } catch {}
      for (const item of (await readdir(absolute)).sort()) await walk(path.join(absolute,item));
    } else if (info.isFile() && (explicit || rawFormats.has(path.extname(absolute).toLowerCase()) || images.has(path.extname(absolute).toLowerCase()) || videos.has(path.extname(absolute).toLowerCase()))) found.add(absolute);
  }
  for (const input of inputs) await walk(input, true);
  return [...found].sort();
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function assertStatic(input: string) {
  const handle = await open(input,'r');
  try {
    const signature = Buffer.alloc(8); await handle.read(signature,0,8,0);
    if (signature.equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
      const length = (await handle.stat()).size; let offset=8;
      while (offset+8 <= length) {
        const header=Buffer.alloc(8); await handle.read(header,0,8,offset);
        const type=header.toString('ascii',4,8);
        if(type==='acTL') throw new Error('Animated PNG is preserved in the source; animation optimization is not supported yet.');
        if(type==='IDAT' || type==='IEND') break;
        offset+=12+header.readUInt32BE(0);
      }
    }
  } finally { await handle.close(); }
  const frames = (await command('magick', ['identify','-ping','-format','%w %h %n %[channels]\n',input])).split('\n');
  if (frames.length > 1 || Number(frames[0].split(' ')[2]) > 1) throw new Error('Animated or multipage images are preserved in the source; optimization is not supported yet.');
}
export async function prepareStill(input: string, temp: string, options: Options = {}, warnings: string[] = []): Promise<string> {
  const raw=rawFormats.has(path.extname(input).toLowerCase());
    let rendered=input;
    if(path.extname(input).toLowerCase()==='.jxl'){
      const details=await command('jxlinfo',[input]);
      if(/animation/i.test(details))throw new Error('Animated JPEG XL is preserved in the source; animation optimization is not supported yet.');
      rendered=path.join(temp,'decoded.png');await command('djxl',[input,rendered]);
    }
    if(raw) {
      // Decode sensor data with LibRaw, not a camera's embedded preview. Work on a copy.
      const copy=path.join(temp,'source'+path.extname(input)); await copyFile(input,copy);
      rendered=path.join(temp,'developed.tiff');
      const rawInfo=await command('raw-identify',['-v',copy],30000);
      const rawCount=rawInfo.match(/Number of raw images:\s*(\d+)/i);
      if(!rawCount)throw new Error('Unable to inspect RAW frame count. Install the complete LibRaw command-line tools.');
      if(Number(rawCount[1])!==1)throw new Error('Multi-shot RAW is preserved in the source; exposure selection/merging is not supported.');
      try { await command('dcraw_emu',[options.rawWhiteBalance==='auto'?'-a':'-w','-o','1','-q','3','-6','-T','-Z',rendered,copy],300000); }
      catch(err) {throw new Error(`RAW development failed. Install LibRaw (brew install libraw; Debian: libraw-bin). Camera/RAW compression must be supported by that build. ${(err as Error).message}`);}
      await stat(rendered);
      warnings.push('RAW developed from sensor data using LibRaw, camera/auto white balance and an sRGB rendering. This is not the camera JPEG look or archival RAW recompression.');
    }
    await assertStatic(rendered);
    const normalized = path.join(temp,'normalized.png');
    await command('magick', [rendered,'-auto-orient','-colorspace','sRGB','-strip',normalized]);
    return normalized;
}
async function image(input: string, dest: string, options: Options, asset: Asset, directory: string, prepared?: string) {
  const profile=profileFor(options.destination);
  const raw=rawFormats.has(path.extname(input).toLowerCase());
  const temp = await mkdtemp(path.join(os.tmpdir(),'hot-image-'));
  try {
    const normalized = prepared || await prepareStill(input,temp,options,asset.warnings!);
    const metadata=(await command('magick',['identify','-ping','-format','%w %h %[channels]',normalized])).split(' ');
    const dims=metadata.slice(0,2).map(Number);
    const transparent=/^(?:s?rgba|graya|cmyka|.*alpha)/i.test(metadata.slice(2).join(''));
    const sourceFormat=({'.jpg':'jpeg','.jpeg':'jpeg','.jpe':'jpeg','.jfif':'jpeg','.png':'png','.webp':'webp','.avif':'avif','.heic':'heic','.heif':'heic','.hif':'heic','.tiff':'tiff','.tif':'tiff','.jxl':'jxl','.gif':'gif','.bmp':'bmp'} as Record<string,string>)[path.extname(input).toLowerCase()];
    const requested=options.format==='preserve' ? raw ? 'tiff':sourceFormat : !options.format||options.format==='auto' ? profile.image : options.format;
    if(!requested) throw new Error('This source format cannot be preserved; choose an output format.');
    const format=transparent ? 'png':requested;
    if(transparent && requested!=='png' && ((options.format && options.format!=='auto') || ['instagram','facebook','tiktok','x'].includes(profile.id))) asset.warnings!.push(`Output changed from ${requested.toUpperCase()} to PNG to preserve transparency.`);
    if(raw && options.format==='preserve') asset.warnings!.push('Preserve source format renders RAW to TIFF; no sensor RAW file is rewritten.');
    const defaultQuality=format==='avif'?50:format==='heic'?80:profile.imageQuality;
    const quality=options.quality ?? (options.preset==='smaller'?Math.max(1,defaultQuality-10):options.preset==='quality'?Math.min(100,defaultQuality+10):defaultQuality);
    if(options.lossless && format==='tiff' && options.tiffCompression==='jpeg')throw new Error('Lossless mode conflicts with JPEG-in-TIFF compression.');
    if(options.lossless && !['png','webp','tiff','jxl','bmp','gif'].includes(format)) throw new Error(`Lossless mode is not offered for ${format.toUpperCase()}. Choose PNG, WebP lossless or TIFF ZIP/LZW.`);
    let scale=1;
    if(options.resize!=='original') {
      if(options.maxWidth)scale=Math.min(1,options.maxWidth/Math.max(...dims));
      else if(profile.imageWidth)scale=Math.min(1,profile.imageWidth/dims[0],profile.imageMax ? profile.imageMax/Math.max(...dims):1);
      else if(profile.imageMax)scale=Math.min(1,profile.imageMax/Math.max(...dims));
    }
    const baseWidth = Math.max(1, Math.round(dims[0]*scale));
    const widths = options.responsive ? [...new Set([...(options.widths || [480,768,1280,1920]).filter(w => w < baseWidth),baseWidth])].sort((a,b)=>a-b) : [baseWidth];
    for (const width of widths) {
      const file = `${dest}${options.responsive ? `-${width}w` : ''}.${format==='jpeg'?'jpg':format}`;
      const target = path.join(directory,file);
      const args = [normalized,'-resize',`${width}x>`,'-strip'];
      if (format === 'png') args.push('-define',`png:compression-level=${options.pngLevel??9}`,'-define','png:exclude-chunk=date,time');
      else if(format==='tiff') {const compression=options.tiffCompression||'zip';if(transparent&&compression==='jpeg')throw new Error('JPEG-in-TIFF cannot safely preserve alpha.');args.push('-compress',compression==='zip'?'Zip':compression==='lzw'?'LZW':compression==='jpeg'?'JPEG':'None');if(compression==='jpeg')args.push('-quality',String(quality));}
      else if(format==='webp' && options.lossless)args.push('-quality','100','-define','webp:lossless=true');
      else if(format==='jxl' && options.lossless)args.push('-quality','100');
      else args.push('-quality',String(quality));
      if(format==='jpeg') args.push('-interlace','Plane','-sampling-factor',options.jpegChroma==='444'?'4:4:4':'4:2:0');
      let measured=target;
      if(format==='jxl') {
        measured=path.join(temp,`jxl-${width}.png`);
        await command('magick',[normalized,'-resize',`${width}x>`,'-strip',measured]);
        await command('cjxl',[measured,target,'-q',String(options.lossless?100:quality),'-e','7','--num_threads=2']);
      } else {args.push(target);await command('magick',args);}
      const [w,h] = (await command('magick',['identify','-ping','-format','%w %h',measured])).split(' ').map(Number);
      asset.outputs.push({file,bytes:(await stat(target)).size,width:w,height:h});
    }
    const largest=asset.outputs.at(-1)!;const src=encodeURIComponent(largest.file);
    if(['webp','avif','jpeg','png','gif','bmp'].includes(format)) asset.html=`<img src="${src}"${options.responsive ? ` srcset="${asset.outputs.map(o=>`${encodeURIComponent(o.file)} ${o.width}w`).join(', ')}" sizes="${escape(options.sizes || '(max-width: 768px) 100vw, 1280px')}"` : ''} width="${largest.width}" height="${largest.height}" alt="" loading="lazy" decoding="async">`;
    else asset.warnings!.push(`${format.toUpperCase()} is not a universal browser delivery format; no HTML snippet generated.`);
    asset.recommendation=`${format.toUpperCase()} · ${format==='png'?'lossless DEFLATE':format==='tiff'?(options.tiffCompression||'ZIP'):(options.lossless?'lossless':`quality ${quality}`)} · sRGB`;
    if(options.destination==='instagram') {
      const ratio=largest.width/largest.height;
      if(ratio<0.8||ratio>1.91)asset.warnings!.push('Aspect ratio is outside Meta’s feed publishing API range (4:5–1.91:1). App uploads can differ; crop deliberately in an editor.');
      if(format!=='jpeg')asset.warnings!.push(`Meta’s feed publishing API requires JPEG; ${format.toUpperCase()} is not accepted by that API. Transparency is never silently flattened.`);
      if(largest.width<320)asset.warnings!.push('Below the Instagram feed API minimum image width (320 px). No upscaling was applied.');
      if(largest.bytes>8_000_000)asset.warnings!.push('Exceeds the Instagram feed API 8 MB image limit.');
    }
  } finally { await rm(temp,{recursive:true,force:true}); }
}
async function video(input: string, dest: string, options: Options, asset: Asset, directory: string, duration?: number) {
  const profile=profileFor(options.destination);
  const probe=JSON.parse(await command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',input]));
  const stream=probe.streams.find((s:any)=>s.codec_type==='video');
  if(!stream)throw new Error('No video stream found.');
  if(/^(?:yuva|rgba|argb|bgra|abgr|gbrap|ya)/.test(stream.pix_fmt||'') || String(stream.tags?.alpha_mode)==='1' || /4444/.test(stream.profile||''))throw new Error('Transparent video is preserved in the source. Video alpha export is not supported.');
  if(['smpte2084','arib-std-b67'].includes(stream.color_transfer) || stream.side_data_list?.some((s:any)=>/DOVI|Mastering display|Content light/i.test(s.side_data_type)))throw new Error('HDR video needs tone mapping; preserved in the source until HDR export is supported.');
  const preserve=options.videoFormat==='preserve';
  const codec=preserve?({h264:'h264',hevc:'hevc',vp9:'vp9',av1:'av1'} as Record<string,string>)[stream.codec_name]:(!options.videoFormat||options.videoFormat==='auto'?'h264':options.videoFormat);
  if(!codec)throw new Error('Source video codec cannot be preserved. Choose H.264, HEVC, VP9 or AV1.');
  const extension=preserve?path.extname(input).slice(1).toLowerCase():codec==='vp9'?'webm':'mp4';
  if(!['mp4','m4v','mov','webm','mkv'].includes(extension) || (extension==='webm'&&!['vp9','av1'].includes(codec)))throw new Error('This codec/container cannot be preserved safely. Choose an explicit video output.');
  const max=Math.min(options.maxWidth||profile.videoMax,8192);
  const file=`${dest}.${extension}`;const target=path.join(directory,file);
  const crf=options.videoCrf??(options.preset==='smaller'?profile.crf+5:options.preset==='quality'?Math.max(0,profile.crf-4):profile.crf);
  const encoder={h264:'libx264',hevc:'libx265',vp9:'libvpx-vp9',av1:'libsvtav1'}[codec as 'h264'|'hevc'|'vp9'|'av1'];
  const filters=[];
  if(stream.field_order && !['progressive','unknown'].includes(stream.field_order))filters.push('bwdif');
  if(options.resize!=='original')filters.push(`scale=w='min(${max},iw)':h='min(${max},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`);
  else filters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
  filters.push('format=yuv420p');
  const args=['-hide_banner','-loglevel','error','-nostdin','-n','-i',input,'-map','0:v:0','-map','0:a:0?','-vf',filters.join(','),'-c:v',encoder,'-crf',String(crf)];
  if(duration)args.push('-t',String(duration));
  const fps=options.frameRate==='source'?undefined:options.frameRate??profile.fps;
  if(fps)args.push('-fpsmax',String(fps));
  if(codec==='h264'||codec==='hevc')args.push('-preset','medium');
  if(codec==='hevc')args.push('-tag:v','hvc1','-x265-params','pools=2:frame-threads=2');
  if(codec==='h264')args.push('-profile:v','high');
  if(codec==='vp9')args.push('-b:v','0','-row-mt','1','-cpu-used','2');
  if(codec==='av1')args.push('-preset','8','-svtav1-params','lp=2');
  const webm=extension==='webm';
  args.push('-c:a',webm?'libopus':'aac','-b:a',`${profile.audio}k`,'-ar','48000','-ac','2','-map_metadata','-1','-map_chapters','-1');
  if(['mp4','mov','m4v'].includes(extension))args.push('-movflags','+faststart');
  args.push(target);await command('ffmpeg',args,30*60*1000);
  const info=JSON.parse(await command('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate','-of','json',target])).streams[0];
  asset.outputs.push({file,bytes:(await stat(target)).size,width:info.width,height:info.height});
  if(['mp4','webm','m4v'].includes(extension))asset.html=`<video controls preload="metadata" width="${info.width}" height="${info.height}"><source src="${encodeURIComponent(file)}" type="${webm?'video/webm':'video/mp4'}"></video>`;
  asset.recommendation=`${codec.toUpperCase()} / ${extension.toUpperCase()} · CRF ${crf} · ${fps?`max ${fps} fps`:'source frame rate'} · ${webm?'Opus':'AAC'} audio`;
  if(codec!=='h264')asset.warnings!.push('Check destination codec acceptance and player support. Use H.264 fallback for broader distribution.');
  if(options.destination==='instagram' || options.destination==='tiktok') {
    if(info.width/info.height!==9/16)asset.warnings!.push('Portrait 9:16 is recommended for full-screen placements. The original aspect ratio was retained.');
    if(Number(stream.avg_frame_rate?.split('/')[0])/Number(stream.avg_frame_rate?.split('/')[1])<23)asset.warnings!.push('Source is below the API minimum of 23 fps. No artificial frames were added.');
  }
  if((options.destination==='instagram'||options.destination==='tiktok') && !['h264','hevc',...(options.destination==='tiktok'?['vp9']:[])].includes(codec))asset.warnings!.push('This codec is not listed in the selected platform’s publishing API specification. Choose H.264 for compatibility.');
  if(options.destination==='instagram'&&asset.outputs[0].bytes>300_000_000)asset.warnings!.push('Exceeds the documented Instagram Reels API 300 MB limit.');
  if(options.destination==='tiktok'&&(info.width<360||info.height<360))asset.warnings!.push('Below TikTok API minimum dimensions (360 px per side). No upscaling was applied.');
  if(options.destination==='x')asset.warnings!.push('Check your account’s video duration and upload size limit before sharing.');
}
export async function renderSample(input: string, directory: string, supplied: Options = {}, prepared?: string): Promise<Asset> {
  const options=validateOptions({...supplied,responsive:false});
  const asset:Asset={source:input,status:'done',warnings:[],inputBytes:(await stat(input)).size,outputs:[]};
  if(videos.has(path.extname(input).toLowerCase()))await video(input,'sample',options,asset,directory,1);
  else if(images.has(path.extname(input).toLowerCase())||rawFormats.has(path.extname(input).toLowerCase()))await image(input,'sample',options,asset,directory,prepared);
  else throw new Error('No image preview is available for this file type.');
  return asset;
}
export async function compress(inputs: string[], supplied: Options = {}, progress?: (asset: Asset, index: number, total: number)=>void): Promise<Report> {
  const options = validateOptions({...supplied});
  if (!inputs.length) throw new Error('Choose at least one file or directory.');
  const output = path.resolve(options.output || 'optimized');
  const files = await discover(inputs,output);
  if (!files.length) throw new Error('No supported media found.');
  await mkdir(output,{recursive:true});
  // Resolving the parent prevents generated result links from using a symlink alias.
  const canonicalOutput = await realpath(output);
  const directory = path.join(canonicalOutput,`batch-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
  await mkdir(directory);
  await writeFile(path.join(directory,'.hot-compress-output'),'Generated assets. Originals are untouched.\n');
  const report: Report = {version:1,directory,assets:[],inputBytes:0,outputBytes:0,savedBytes:0,options};
  for (const [index,input] of files.entries()) {
    const asset: Asset = {source:input,status:'done',warnings:[],inputBytes:(await stat(input)).size,outputs:[]};
    const extension = path.extname(input).toLowerCase();
    // Include the original extension and a stable path digest to prevent basename collisions.
    const dest = `${path.basename(input).replace(/[^a-zA-Z0-9._-]/g,'_')}-${createHash('sha256').update(input).digest('hex').slice(0,8)}`;
    try {
      if (images.has(extension)||rawFormats.has(extension)) await image(input,dest,options,asset,directory);
      else if (videos.has(extension)) await video(input,dest,options,asset,directory);
      else { asset.status = 'skipped'; asset.reason = 'Unsupported file type.'; }
    } catch (err) {
      asset.status = 'error'; asset.reason = (err as Error).message;
      // Never publish partial files as successful results.
      for (const name of await readdir(directory)) if (name.startsWith(dest)) await rm(path.join(directory,name),{force:true});
      asset.outputs = []; delete asset.html;
    }
    report.assets.push(asset); progress?.(asset,index+1,files.length);
  }
  report.inputBytes = report.assets.filter(a=>a.status === 'done').reduce((sum,a)=>sum+a.inputBytes,0);
  report.outputBytes = report.assets.flatMap(a=>a.outputs).reduce((sum,a)=>sum+a.bytes,0);
  report.savedBytes = report.inputBytes-report.outputBytes;
  await writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));
  await writeFile(path.join(directory,'snippets.html'),`<!-- Review alt text, sizes, and loading priority before use. Hero/LCP images should use loading="eager" and fetchpriority="high". Paths are relative to this output folder. -->\n${report.assets.flatMap(a=>a.html ? [`<!-- ${escape(path.basename(a.source))} -->`,a.html] : []).join('\n')}\n`);
  return report;
}
async function executable(name: string) {
  for(const directory of (process.env.PATH||'').split(path.delimiter)) {
    const candidate=path.join(directory,name);
    try {await access(candidate,constants.X_OK);if((await stat(candidate)).isFile())return candidate;}catch{}
  }
  throw new Error(`${name} is not installed.`);
}
export async function capabilities() {
  const [formats,encoders,raw]=await Promise.all([
    command('magick',['identify','-list','format']).catch(()=>''),
    command('ffmpeg',['-hide_banner','-encoders']).catch(()=>''),
    Promise.all([executable('dcraw_emu'),executable('raw-identify')]).then(()=>true).catch(()=>false),
  ]);
  const writers: Record<string,boolean>={};
  for(const format of ['JPEG','PNG','WEBP','AVIF','TIFF','HEIC','JXL'])writers[format.toLowerCase()]=new RegExp(`^\\s*${format}\\*?\\s+\\S+\\s+\\S*w`,'m').test(formats);
  writers.jxl=await executable('cjxl').then(()=>true).catch(()=>false);
  return {raw,image:writers,video:Object.fromEntries(Object.entries({h264:'libx264',hevc:'libx265',vp9:'libvpx-vp9',av1:'libsvtav1'}).map(([k,v])=>[k,encoders.includes(v)]))};
}
export async function doctor() {
  return Promise.all(['magick','ffmpeg','ffprobe','zip','dcraw_emu','raw-identify'].map(async bin=>{
    try {
      if(bin==='dcraw_emu'||bin==='raw-identify')return {tool:bin,available:true,detail:`LibRaw tool: ${await executable(bin)}`};
      const result=await command(bin,bin==='zip'?['-v']:['-version'],10000);
      return {tool:bin,available:true,detail:result.split('\n')[0]};
    }catch(err){return {tool:bin,available:false,detail:(err as Error).message};}
  }));
}
