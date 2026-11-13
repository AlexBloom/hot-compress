import { spawn } from 'node:child_process';
import { mkdir, readdir, lstat, stat, writeFile, readFile, mkdtemp, rm, realpath, open } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';

export type Options = { format?: 'webp' | 'avif'; preset?: 'balanced' | 'smaller' | 'quality'; responsive?: boolean; widths?: number[]; sizes?: string; maxWidth?: number; output?: string };
export type Asset = { source: string; status: 'done' | 'error' | 'skipped'; reason?: string; inputBytes: number; outputs: { file: string; bytes: number; width: number; height: number }[]; html?: string; recommendation?: string };
export type Report = { version: number; directory: string; assets: Asset[]; inputBytes: number; outputBytes: number; savedBytes: number; options: Options };
export const images = new Set(['.jpg','.jpeg','.png','.tif','.tiff','.heic','.heif','.hif','.webp','.avif','.bmp','.gif']);
export const videos = new Set(['.mp4','.mov','.m4v','.webm','.mkv','.avi','.mts','.m2ts']);
const ignored = new Set(['.git','node_modules','.hot-compress','dist']);
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
  if (options.format && !['webp','avif'].includes(options.format)) throw new Error('Format must be webp or avif. Transparency always uses PNG.');
  if (options.preset && !['balanced','smaller','quality'].includes(options.preset)) throw new Error('Preset must be balanced, smaller, or quality.');
  if (options.maxWidth !== undefined && (!Number.isInteger(options.maxWidth) || options.maxWidth < 16 || options.maxWidth > 16384)) throw new Error('Max width must be an integer from 16 to 16384.');
  if (options.widths && (!Array.isArray(options.widths) || options.widths.length > 12 || options.widths.some(w => !Number.isInteger(w) || w < 16 || w > 16384))) throw new Error('Use up to 12 widths between 16 and 16384.');
  if (options.sizes !== undefined && (typeof options.sizes !== 'string' || options.sizes.length > 2000)) throw new Error('Invalid sizes attribute.');
  return options;
}
export async function discover(inputs: string[], output: string): Promise<string[]> {
  const found = new Set<string>();
  async function walk(entry: string, explicit = false) {
    const absolute = path.resolve(entry);
    if (absolute === output || absolute.startsWith(output + path.sep)) return;
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) return;
    if (info.isDirectory()) {
      if (!explicit && (ignored.has(path.basename(absolute)) || path.basename(absolute).startsWith('.'))) return;
      try { await stat(path.join(absolute, '.hot-compress-output')); return; } catch {}
      for (const item of (await readdir(absolute)).sort()) await walk(path.join(absolute,item));
    } else if (info.isFile() && (explicit || images.has(path.extname(absolute).toLowerCase()) || videos.has(path.extname(absolute).toLowerCase()))) found.add(absolute);
  }
  for (const input of inputs) await walk(input, true);
  return [...found].sort();
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function image(input: string, dest: string, options: Options, asset: Asset, directory: string) {
  // Some ImageMagick builds see APNG as a static PNG. Check its animation chunk directly.
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
  // Identify the whole sequence first: never silently take the first frame/page.
  const frames = (await command('magick', ['identify','-ping','-format','%w %h %n %[channels]\n',input])).split('\n');
  const parts = frames[0].split(' ');
  if (frames.length > 1 || Number(parts[2]) > 1) throw new Error('Animated or multipage images are preserved in the source; optimization is not supported yet.');
  const transparent = /a/i.test(parts.slice(3).join(''));
  const format = transparent ? 'png' : options.format || 'webp';
  const preset = options.preset || 'balanced';
  const quality = { balanced: {webp:80,avif:50}, smaller:{webp:72,avif:42}, quality:{webp:90,avif:65} }[preset];
  const temp = await mkdtemp(path.join(os.tmpdir(),'hot-image-'));
  try {
    const normalized = path.join(temp,'normalized.png');
    await command('magick', [input,'-auto-orient','-colorspace','sRGB','-strip',normalized]);
    const dims = (await command('magick',['identify','-ping','-format','%w %h',normalized])).split(' ').map(Number);
    const max = Math.min(options.maxWidth || 2560, Math.max(...dims));
    const scale = Math.min(1, max / Math.max(...dims));
    const baseWidth = Math.max(1, Math.round(dims[0]*scale));
    const widths = options.responsive ? [...new Set([...(options.widths || [480,768,1280,1920]).filter(w => w < baseWidth),baseWidth])].sort((a,b)=>a-b) : [baseWidth];
    for (const width of widths) {
      const file = `${dest}${options.responsive ? `-${width}w` : ''}.${format}`;
      const target = path.join(directory,file);
      const args = [normalized,'-resize',`${width}x>`,`-strip`];
      if (format === 'png') args.push('-define','png:compression-level=9','-define','png:exclude-chunk=date,time');
      else args.push('-quality',String(quality[format]));
      args.push(target);
      await command('magick', args);
      const [w,h] = (await command('magick',['identify','-ping','-format','%w %h',target])).split(' ').map(Number);
      asset.outputs.push({file,bytes:(await stat(target)).size,width:w,height:h});
    }
    const largest = asset.outputs.at(-1)!;
    const src = encodeURIComponent(largest.file);
    asset.html = `<img src="${src}"${options.responsive ? ` srcset="${asset.outputs.map(o=>`${encodeURIComponent(o.file)} ${o.width}w`).join(', ')}" sizes="${escape(options.sizes || '(max-width: 768px) 100vw, 1280px')}"` : ''} width="${largest.width}" height="${largest.height}" alt="" loading="lazy" decoding="async">`;
    asset.recommendation = transparent ? 'PNG preserves transparency and crisp graphics.' : format === 'avif' ? 'AVIF makes smaller images; slower to export.' : 'WebP is recommended for most web images.';
  } finally { await rm(temp,{recursive:true,force:true}); }
}
async function video(input: string, dest: string, options: Options, asset: Asset, directory: string) {
  const probe = JSON.parse(await command('ffprobe',['-v','error','-show_streams','-of','json',input]));
  const stream = probe.streams.find((s: any)=>s.codec_type === 'video');
  if (!stream) throw new Error('No video stream found.');
  if (/a/.test(stream.pix_fmt || '') || String(stream.tags?.alpha_mode) === '1' || /4444/.test(stream.profile || '')) throw new Error('Transparent video is preserved in the source. MP4 export would remove alpha; WebM alpha export is planned.');
  if (['smpte2084','arib-std-b67'].includes(stream.color_transfer)) throw new Error('HDR video needs tone mapping; preserved in the source until HDR export is supported.');
  const max = Math.min(options.maxWidth || 1920, 3840);
  const file = `${dest}.mp4`;
  const target = path.join(directory,file);
  const crf = {balanced:23,smaller:28,quality:19}[options.preset || 'balanced'];
  await command('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-n','-i',input,'-map','0:v:0','-map','0:a:0?','-vf',`scale=w='min(${max},iw)':h='min(${max},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p`,'-fpsmax','30','-c:v','libx264','-preset','medium','-crf',String(crf),'-c:a','aac','-b:a','128k','-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',target], 30*60*1000);
  const info = JSON.parse(await command('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',target])).streams[0];
  asset.outputs.push({file,bytes:(await stat(target)).size,width:info.width,height:info.height});
  asset.html = `<video controls preload="metadata" width="${info.width}" height="${info.height}"><source src="${encodeURIComponent(file)}" type="video/mp4"></video>`;
  asset.recommendation = 'MP4 is recommended for web video. Audio is retained; maximum 30 fps. Responsive variants apply to images only.';
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
    const asset: Asset = {source:input,status:'done',inputBytes:(await stat(input)).size,outputs:[]};
    const extension = path.extname(input).toLowerCase();
    // Include the original extension and a stable path digest to prevent basename collisions.
    const dest = `${path.basename(input).replace(/[^a-zA-Z0-9._-]/g,'_')}-${createHash('sha256').update(input).digest('hex').slice(0,8)}`;
    try {
      if (images.has(extension)) await image(input,dest,options,asset,directory);
      else if (videos.has(extension)) await video(input,dest,options,asset,directory);
      else { asset.status = 'skipped'; asset.reason = 'Unsupported file type. Camera RAW is planned for a later release.'; }
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
export async function doctor() {
  const checks = await Promise.all(['magick','ffmpeg','ffprobe','zip'].map(async bin => {
    try { const result = await command(bin,bin === 'zip' ? ['-v'] : ['-version'],10000); return {tool:bin,available:true,detail:result.split('\n')[0]}; }
    catch (err) { return {tool:bin,available:false,detail:(err as Error).message}; }
  }));
  return checks;
}
