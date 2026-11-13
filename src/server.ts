import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { compress, command, doctor, validateOptions, type Options, type Report } from './engine.ts';

export async function serve(port = 4318, open = true) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be 1024–65535.');
  const token = randomUUID();
  const workspace = await mkdtemp(path.join(os.tmpdir(),'hot-compress-gui-'));
  const web = fileURLToPath(new URL('../web/',import.meta.url));
  const uploads = new Map<string,string>();
  const jobs = new Map<string,{state:string;current:number;total:number;asset?:string;report?:Report;error?:string}>();
  let busy = false;
  const origin = `http://127.0.0.1:${port}`;
  function json(res: http.ServerResponse, code: number, data: unknown) { res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data)); }
  async function body(req: http.IncomingMessage) { let value=''; for await (const chunk of req) {value+=chunk;if(value.length>64000) throw new Error('Request too large');} return JSON.parse(value); }
  const server = http.createServer(async (req,res)=> {
    try {
      if (req.headers.host !== `127.0.0.1:${port}`) return json(res,403,{error:'Invalid host'});
      if (req.headers.origin && req.headers.origin !== origin) return json(res,403,{error:'Invalid origin'});
      const url = new URL(req.url!,origin);
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET') return json(res,405,{error:'Method not allowed'});
        const filename = {'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[url.pathname];
        if (!filename) return json(res,404,{error:'Not found'});
        const mime = filename.endsWith('.css') ? 'text/css' : filename.endsWith('.js') ? 'text/javascript' : 'text/html';
        res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'}); return res.end(await readFile(path.join(web,filename)));
      }
      const supplied = req.headers['x-hot-token'] || url.searchParams.get('token') || '';
      if (typeof supplied !== 'string' || supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied),Buffer.from(token))) return json(res,403,{error:'Open the GUI using the terminal link to authorize this session.'});
      if (url.pathname === '/api/doctor' && req.method === 'GET') return json(res,200,await doctor());
      if (url.pathname === '/api/upload' && req.method === 'POST') {
        if (busy) return json(res,409,{error:'Wait for the current batch before uploading another.'});
        const relative = decodeURIComponent(String(req.headers['x-file-name'] || ''));
        const segments = relative.split('/');
        if (!relative || segments.some(p=>!p || p==='.' || p==='..' || /[\\\x00-\x1f]/.test(p)) || relative.length>2000) throw new Error('Invalid file path');
        const id = randomUUID();const directory=path.join(workspace,'uploads',id);const target=path.join(directory,...segments);
        await mkdir(path.dirname(target),{recursive:true});
        let size=0; const limit=4*1024**3;
        const limiter = new Transform({transform(chunk,_encoding,done){size+=chunk.length;done(size>limit ? new Error('File exceeds 4 GB upload limit; use a directory path or CLI.') : null,chunk);}});
        try { await pipeline(req,limiter,createWriteStream(target,{flags:'wx'})); uploads.set(id,target); }
        catch(err){await rm(directory,{recursive:true,force:true});throw err;}
        return json(res,200,{id});
      }
      if (url.pathname === '/api/jobs' && req.method === 'POST') {
        if (busy) return json(res,409,{error:'A batch is already running.'});
        const data = await body(req);
        const options: Options = validateOptions({format:data.options?.format,preset:data.options?.preset,responsive:data.options?.responsive,widths:data.options?.widths,sizes:data.options?.sizes,maxWidth:data.options?.maxWidth});
        if (typeof options.responsive !== 'undefined' && typeof options.responsive !== 'boolean') throw new Error('Invalid responsive option');
        const ids: string[] = data.ids || [];
        if (!Array.isArray(ids) || ids.length>10000 || ids.some(id=>!uploads.has(id))) throw new Error('Unknown upload');
        const inputs = data.directory ? [String(data.directory)] : ids.map(id=>uploads.get(id)!);
        if (!inputs.length) throw new Error('Choose files or a directory.');
        // GUI outputs live in a persistent folder, never in the temporary upload tree.
        options.output=path.resolve('optimized');
        const id=randomUUID();const job={state:'running',current:0,total:0} as {state:string;current:number;total:number;asset?:string;report?:Report;error?:string};
        jobs.set(id,job);busy=true;
        void compress(inputs,options,(asset,current,total)=>Object.assign(job,{current,total,asset:path.basename(asset.source)})).then(report=>{job.report=report;job.state='done';}).catch(err=>{job.state='error';job.error=err.message;}).finally(async()=>{busy=false;for(const upload of ids){const file=uploads.get(upload);uploads.delete(upload);if(file)await rm(path.join(workspace,'uploads',upload),{recursive:true,force:true});}});
        return json(res,202,{id});
      }
      const match=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)(?:\/(download|zip))?$/);
      if(match && req.method === 'GET') {
        const job=jobs.get(match[1]);if(!job)return json(res,404,{error:'Unknown batch'});
        if(!match[2])return json(res,200,job);
        if(!job.report)return json(res,409,{error:'Batch is not ready'});
        let target: string;
        if(match[2]==='zip') {
          target=path.join(workspace,`${match[1]}.zip`);
          try{await stat(target);}catch{
            // Absolute input paths, no shell interpolation. Archive contains generated files only.
            const archive = path.join(workspace,`${match[1]}-${randomUUID()}.zip`);
            const {spawn}=await import('node:child_process');
            await new Promise<void>((resolve,reject)=>{const p=spawn('zip',['-q','-r',archive,'.'],{cwd:job.report!.directory,stdio:'ignore'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error('ZIP failed')));});
            const {rename}=await import('node:fs/promises');await rename(archive,target);
          }
        } else {
          const file=url.searchParams.get('file') || '';
          const allowed=new Set(['report.json','snippets.html',...job.report.assets.flatMap(a=>a.outputs.map(o=>o.file))]);
          if(!allowed.has(file))return json(res,404,{error:'Unknown output'});
          target=path.join(job.report.directory,file);
        }
        const info=await stat(target);
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':info.size,'Content-Disposition':`attachment; filename="${path.basename(target).replace(/[^a-zA-Z0-9._-]/g,'_')}"`});
        await pipeline(createReadStream(target),res);return;
      }
      json(res,404,{error:'Not found'});
    } catch(err){if(!res.headersSent)json(res,400,{error:(err as Error).message});else res.destroy();}
  });
  server.requestTimeout=30*60*1000;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const link=`${origin}/#${token}`;
  console.log(`Hot Compress is running locally: ${link}\nFiles stay on this Mac. Outputs: ${path.resolve('optimized')}\nPress Ctrl+C to stop.`);
  if(open) { const bin=process.platform==='darwin'?'open':process.platform==='win32'?'explorer':'xdg-open';void command(bin,[link],10000).catch(()=>{}); }
  server.on('close',()=>{void rm(workspace,{recursive:true,force:true});});
  return {server,link};
}
