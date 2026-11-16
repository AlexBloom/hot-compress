import { randomUUID, createHash } from 'node:crypto';
import { mkdir, stat, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { command, prepareStill, renderSample, videos, images, rawFormats, type Options } from './engine.ts';
export type MediaEntry={id:string;name:string;bytes:number;kind:'image'|'video'|'file'};
type Source=MediaEntry&{path:string};
type Sample={directory:string;before:string;after:string;width:number;height:number;bytes:number;format:string;warnings:string[];video:boolean};
export class PreviewLibrary {
  private sources=new Map<string,Source>();private byPath=new Map<string,string>();
  private normalized=new Map<string,Promise<string>>();private samples=new Map<string,Promise<Sample>>();private thumbs=new Map<string,Promise<string>>();
  private readers=new Map<string,number>();private assets=new Map<string,string>();private active=0;private queue:(()=>void)[]=[];
  constructor(private root:string){}
  async register(paths:string[],relativeTo?:string):Promise<MediaEntry[]> {
    return Promise.all(paths.map(async file=>{
      const info=await stat(file);let id=this.byPath.get(file);if(!id){id=randomUUID();this.byPath.set(file,id);}
      const source:Source={id,path:file,name:relativeTo?path.relative(relativeTo,file):path.basename(file),bytes:info.size,kind:videos.has(path.extname(file).toLowerCase())?'video':images.has(path.extname(file).toLowerCase())||rawFormats.has(path.extname(file).toLowerCase())?'image':'file'};
      this.sources.set(id,source);const {path:_path,...entry}=source;return entry;
    }));
  }
  source(id:string){const source=this.sources.get(id);if(!source)throw new Error('Unknown media. Choose the files again.');return source;}
  file(id:string){return this.assets.get(id);}
  private publish(file:string){const id=randomUUID();this.assets.set(id,file);return id;}
  private async limited<T>(work:()=>Promise<T>):Promise<T>{
    if(this.active>=2)await new Promise<void>(resolve=>this.queue.push(resolve));else this.active++;
    try{return await work();}finally{const next=this.queue.shift();if(next)next();else this.active--;}
  }
  private async key(source:Source,options:unknown){const info=await stat(source.path);return createHash('sha256').update(JSON.stringify([source.id,info.size,info.mtimeMs,options])).digest('hex');}
  private async normalize(source:Source,wb:Options['rawWhiteBalance']='camera'){
    const key=await this.key(source,{wb});let task=this.normalized.get(key);
    if(!task){task=(async()=>{const dir=path.join(this.root,'source-'+key);await mkdir(dir,{recursive:true});const normalized=await prepareStill(source.path,dir,{rawWhiteBalance:wb});for(const name of await readdir(dir))if(name!==path.basename(normalized))await rm(path.join(dir,name),{recursive:true,force:true});return normalized;})();this.normalized.set(key,task);task.catch(()=>this.normalized.delete(key));}return task;
  }
  async thumbnail(id:string,wb:Options['rawWhiteBalance']='camera'){
    const source=this.source(id);if(source.kind==='file')throw new Error('No thumbnail is available for this file type.');const key=await this.key(source,{wb});let task=this.thumbs.get(key);
    if(!task){task=this.limited(async()=>{
      const directory=path.join(this.root,'thumb-'+key);await mkdir(directory,{recursive:true});const output=path.join(directory,'thumb.webp');
      if(source.kind==='video'){
        const probe=JSON.parse(await command('ffprobe',['-v','error','-select_streams','v:0','-show_streams','-of','json',source.path]));
        if(['smpte2084','arib-std-b67'].includes(probe.streams[0]?.color_transfer))throw new Error('HDR thumbnail unavailable.');
        const frame=path.join(directory,'frame.png');await command('ffmpeg',['-v','error','-nostdin','-n','-i',source.path,'-frames:v','1','-vf',"scale=w='min(280,iw)':h='min(200,ih)':force_original_aspect_ratio=decrease",frame]);
        await command('magick',[frame,'-strip','-quality','65',output]);
      }else{const prepared=await this.normalize(source,wb);await command('magick',[prepared,'-resize','280x200>','-strip','-quality','65',output]);}
      return output;
    });this.thumbs.set(key,task);task.catch(()=>this.thumbs.delete(key));}return task;
  }
  async preview(id:string,options:Options,region:{x:number;y:number}={x:.5,y:.5}){
    if(!Number.isFinite(region.x)||!Number.isFinite(region.y)||region.x<0||region.x>1||region.y<0||region.y>1)throw new Error('Crop position must be between 0 and 1.');
    const source=this.source(id);const {output:_output,responsive:_responsive,widths:_widths,sizes:_sizes,...settings}=options;
    const key=await this.key(source,settings);this.readers.set(key,(this.readers.get(key)||0)+1);try {let sample=this.samples.get(key);
    if(!sample){sample=this.limited(async()=>{
      const directory=path.join(this.root,'sample-'+key+'-'+randomUUID());await mkdir(directory,{recursive:true});
      const prepared=source.kind==='image'?await this.normalize(source,settings.rawWhiteBalance):undefined;
      const asset=await renderSample(source.path,directory,settings,prepared);const result=asset.outputs[0];const encoded=path.join(directory,result.file);
      const before=path.join(directory,'before.png'),after=path.join(directory,'after.png');
      if(source.kind==='video'){
        await command('ffmpeg',['-v','error','-nostdin','-n','-i',source.path,'-frames:v','1','-vf',`scale=${result.width}:${result.height}`,before]);
        await command('ffmpeg',['-v','error','-nostdin','-n','-i',encoded,'-frames:v','1',after]);
      }else{
        await command('magick',[prepared!,'-resize',`${result.width}x${result.height}!`,'-strip',before]);
        if(encoded.endsWith('.jxl'))await command('djxl',[encoded,after]);else await command('magick',[encoded,'-strip',after]);
      }
      return {directory,before,after,width:result.width,height:result.height,bytes:result.bytes,format:path.extname(result.file).slice(1).toUpperCase(),warnings:asset.warnings||[],video:source.kind==='video'};
    });this.samples.set(key,sample);sample.catch(()=>{this.samples.delete(key);});

    }
    const result=await sample;
    const width=Math.min(384,result.width),height=Math.min(384,result.height),left=Math.round((result.width-width)*region.x),top=Math.round((result.height-height)*region.y);
    const crop=async(input:string,label:string)=>{const output=path.join(result.directory,`${label}-${left}-${top}.png`);await command('magick',[input,'-crop',`${width}x${height}+${left}+${top}`,'+repage','-strip',output]);return this.publish(output);};
    const [before,after]=await Promise.all([crop(result.before,'before'),crop(result.after,'after')]);
    return {before,after,width,height,outputWidth:result.width,outputHeight:result.height,bytes:result.bytes,format:result.format,warnings:result.warnings,note:result.video?'First frame of a 1-second encoded sample. Video size is for that sample.':'Crop at export resolution. Source is resized to the same dimensions for comparison.'};
    } finally {
      const count=(this.readers.get(key)||1)-1;if(count)this.readers.set(key,count);else this.readers.delete(key);
      for(const [oldKey,old] of this.samples){if(this.samples.size<=16)break;if(this.readers.has(oldKey)||oldKey===key)continue;this.samples.delete(oldKey);void old.then(value=>{for(const [id,file] of this.assets)if(file.startsWith(value.directory+path.sep))this.assets.delete(id);return rm(value.directory,{recursive:true,force:true});}).catch(()=>{});}
    }
  }
}
