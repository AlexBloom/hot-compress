import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {compress,command,validateOptions,discover} from '../dist/engine.js';
import {serve} from '../dist/server.js';

async function fixture(t){const dir=await mkdtemp(path.join(os.tmpdir(),'hot-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('camera formats, PNG transparency, responsive widths, orientation, source preservation, repeat safety',async t=>{
 const dir=await fixture(t);const input=path.join(dir,'input');await mkdir(input);
 const png=path.join(input,'alpha.png');await command('magick',['-size','900x600','xc:none','-fill','#ff660080','-draw','rectangle 100,100 700,500',png]);
 await command('magick',['-size','900x600','gradient:#304535-#eecc99',path.join(input,'photo.jpg')]);
 await command('magick',[path.join(input,'photo.jpg'),path.join(input,'camera.tiff')]);
 await command('magick',[path.join(input,'photo.jpg'),path.join(input,'camera.heic')]);
 const before=await readFile(png);
 const report=await compress([input],{output:path.join(dir,'out'),responsive:true,widths:[320,640,1200]});
 assert.equal(report.assets.length,4);assert.ok(report.assets.every(a=>a.status==='done'),JSON.stringify(report.assets));
 const alpha=report.assets.find(a=>a.source===png);assert.deepEqual(alpha.outputs.map(o=>o.width),[320,640,900]);
 assert.ok(alpha.outputs.every(o=>o.file.endsWith('.png')));
 const output=path.join(report.directory,alpha.outputs.at(-1).file);
 assert.match(await command('magick',['identify','-format','%[channels]',output]),/a/);
 assert.equal(await command('magick',[output,'-format','%[pixel:p{0,0}]','info:']),'srgba(0,0,0,0)');
 assert.deepEqual(await readFile(png),before);
 assert.ok(alpha.html.includes('320w'));assert.ok(alpha.html.includes('sizes='));
 const again=await compress([png],{output:path.join(dir,'out')});assert.notEqual(again.directory,report.directory);await stat(output);
 const scan=await discover([dir],path.join(dir,'other-output'));assert.equal(scan.length,4);
});
test('video becomes H.264 MP4 with bounded dimensions and audio retained',async t=>{
 const dir=await fixture(t);const source=path.join(dir,'video.mov');
 await command('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x240:rate=60','-f','lavfi','-i','sine=frequency=440','-t','0.4','-c:v','libx264','-c:a','aac',source]);
 const report=await compress([source],{output:path.join(dir,'out'),maxWidth:160});
 assert.equal(report.assets[0].status,'done',report.assets[0].reason);
 const result=report.assets[0].outputs[0];assert.equal(result.width,160);
 const probe=JSON.parse(await command('ffprobe',['-v','error','-show_streams','-of','json',path.join(report.directory,result.file)]));
 assert.equal(probe.streams[0].codec_name,'h264');assert.ok(probe.streams.some(s=>s.codec_type==='audio'));assert.ok(evalFraction(probe.streams[0].avg_frame_rate)<=30);
});
const evalFraction=s=>{const[a,b]=s.split('/').map(Number);return a/b;};
test('rejects destructive animation flattening, bad options, invalid files; batch continues',async t=>{
 const dir=await fixture(t);const gif=path.join(dir,'animated.gif');
 await command('magick',['-size','20x20','xc:red','-size','20x20','xc:blue','-loop','0',gif]);
 const bad=path.join(dir,'broken.jpg');await writeFile(bad,'not an image');
 const good=path.join(dir,'fine.jpg');await command('magick',['-size','20x20','xc:red',good]);
 const report=await compress([gif,bad,good],{output:path.join(dir,'out')});
 assert.equal(report.assets.filter(a=>a.status==='error').length,2);assert.equal(report.assets.filter(a=>a.status==='done').length,1);
 assert.ok(report.assets.filter(a=>a.status==='error').every(a=>!a.outputs.length));
 assert.throws(()=>validateOptions({format:'invalid'}));assert.throws(()=>validateOptions({widths:[NaN]}));
});
test('AVIF output, EXIF rotation and no upscale',async t=>{
 const dir=await fixture(t);const source=path.join(dir,'oriented.tiff');
 await command('magick',['-size','120x80','gradient:red-blue','-orient','RightTop',source]);
 const report=await compress([source],{output:path.join(dir,'out'),format:'avif'});
 assert.equal(report.assets[0].status,'done',report.assets[0].reason);
 const result=report.assets[0].outputs[0];assert.equal(result.width,80);assert.equal(result.height,120);assert.ok(result.file.endsWith('.avif'));
});
test('local server requires token, rejects traversal, processes uploaded file, downloads generated results',async t=>{
 const dir=await fixture(t);const source=path.join(dir,'test.png');await command('magick',['-size','20x20','xc:none',source]);
 const {server,link}=await serve(14318,false);t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=link.split('/#')[0],token=link.split('#')[1],headers={'x-hot-token':token};
 assert.equal((await fetch(base+'/api/doctor')).status,403);
 assert.equal((await fetch(base+'/api/doctor',{headers:{...headers,Origin:'https://elsewhere.test'}})).status,403);
 assert.equal((await fetch(base+'/api/upload',{method:'POST',headers:{...headers,'x-file-name':'..%2Fbad.png'},body:'bad'})).status,400);
 const upload=await fetch(base+'/api/upload',{method:'POST',headers:{...headers,'x-file-name':'folder%2Ftest.png'},body:await readFile(source)});assert.equal(upload.status,200);const{id}=await upload.json();
 const response=await fetch(base+'/api/jobs',{method:'POST',headers,body:JSON.stringify({ids:[id],options:{}})});assert.equal(response.status,202);const jobId=(await response.json()).id;
 let job;for(let i=0;i<100;i++){job=await(await fetch(`${base}/api/jobs/${jobId}`,{headers})).json();if(job.state!=='running')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(job.state,'done');assert.equal(job.report.assets[0].status,'done');t.after(()=>rm(job.report.directory,{recursive:true,force:true}));
 assert.equal((await fetch(`${base}/api/jobs/${jobId}/download?file=..%2Fsecret&token=${token}`)).status,404);
 const download=await fetch(`${base}/api/jobs/${jobId}/download?file=${job.report.assets[0].outputs[0].file}&token=${token}`);assert.equal(download.status,200);assert.ok((await download.arrayBuffer()).byteLength);
 const zip=await fetch(`${base}/api/jobs/${jobId}/zip?token=${token}`);assert.equal(zip.status,200);assert.equal(Buffer.from(await zip.arrayBuffer()).subarray(0,2).toString(),'PK');
});
test('APNG animation, alpha video, and HDR video are reported without flattening',async t=>{
 const dir=await fixture(t);const apng=path.join(dir,'animated.png'),alpha=path.join(dir,'alpha.mov'),hdr=path.join(dir,'hdr.mp4');
 await command('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=32x32:rate=5','-t','0.4','-plays','0','-f','apng',apng]);
 await command('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red@0.5:s=32x32:r=5,format=argb','-t','0.4','-c:v','qtrle',alpha]);
 await command('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=32x32:rate=5','-t','0.4','-vf','setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc','-c:v','libx264',hdr]);
 const report=await compress([apng,alpha,hdr],{output:path.join(dir,'out')});
 assert.ok(report.assets.every(a=>a.status==='error'&&a.outputs.length===0),JSON.stringify(report.assets));
 assert.ok(report.assets.some(a=>a.reason.includes('Animated PNG')));
 assert.ok(report.assets.some(a=>a.reason.includes('Transparent video')));
 assert.ok(report.assets.some(a=>a.reason.includes('HDR video')));
});
test('same basenames in different folders never collide; alpha values survive PNG export',async t=>{
 const dir=await fixture(t);await mkdir(path.join(dir,'a'));await mkdir(path.join(dir,'b'));
 for(const folder of ['a','b'])await command('magick',['-size','40x40','xc:rgba(24,80,120,0.35)',path.join(dir,folder,'same.png')]);
 const report=await compress([path.join(dir,'a'),path.join(dir,'b')],{output:path.join(dir,'out')});
 assert.equal(new Set(report.assets.flatMap(a=>a.outputs.map(o=>o.file))).size,2);
 for(const asset of report.assets){assert.equal(asset.status,'done');const pixel=await command('magick',[path.join(report.directory,asset.outputs[0].file),'-format','%[fx:p{0,0}.a]','info:']);assert.ok(Math.abs(Number(pixel)-0.35)<0.005);}
});
test('RAW DNG develops sensor data and preserve renders to TIFF without touching the RAW',async t=>{
 const {syntheticDng}=await import('./raw-fixture.mjs');const dir=await fixture(t);const source=path.join(dir,'sensor.dng');const original=syntheticDng();await writeFile(source,original);
 const scan=await discover([dir],path.join(dir,'out'));assert.deepEqual(scan,[source]);
 const report=await compress([source],{format:'preserve',output:path.join(dir,'out'),rawWhiteBalance:'camera'});
 assert.equal(report.assets[0].status,'done',report.assets[0].reason);assert.ok(report.assets[0].outputs[0].file.endsWith('.tiff'));
 assert.ok(report.assets[0].warnings.some(w=>w.includes('sensor data')));assert.ok(report.assets[0].warnings.some(w=>w.includes('RAW to TIFF')));assert.deepEqual(await readFile(source),original);
 const web=await compress([source],{output:path.join(dir,'out'),rawWhiteBalance:'auto'});assert.equal(web.assets[0].status,'done',web.assets[0].reason);assert.ok(web.assets[0].outputs[0].file.endsWith('.webp'));
});
test('custom JPEG, source preservation, TIFF compressions and PNG effort are real output controls',async t=>{
 const dir=await fixture(t);const source=path.join(dir,'photo.jpg');await command('magick',['-size','96x64','gradient:red-blue',source]);
 const preserved=await compress([source],{format:'preserve',quality:91,jpegChroma:'444',output:path.join(dir,'out')});assert.equal(preserved.assets[0].status,'done');assert.ok(preserved.assets[0].outputs[0].file.endsWith('.jpg'));
 for(const tiffCompression of ['zip','lzw','jpeg','none']){
  const report=await compress([source],{format:'tiff',tiffCompression,output:path.join(dir,'out')});assert.equal(report.assets[0].status,'done',report.assets[0].reason);
  const compression=await command('magick',['identify','-format','%C',path.join(report.directory,report.assets[0].outputs[0].file)]);assert.equal(compression.toLowerCase(),tiffCompression);
 }
 const alpha=path.join(dir,'alpha.png');await command('magick',['-size','80x60','xc:rgba(40,80,120,0.5)',alpha]);
 for(const pngLevel of [0,9]){const report=await compress([alpha],{format:'jpeg',pngLevel,output:path.join(dir,'out')});assert.equal(report.assets[0].status,'done');assert.ok(report.assets[0].outputs[0].file.endsWith('.png'));assert.ok(report.assets[0].warnings.some(w=>w.includes('preserve transparency')));}
});
test('WebP and JPEG XL lossless modes, JXL decoding and JXL animation rejection',async t=>{
 const {capabilities}=await import('../dist/engine.js');const dir=await fixture(t);const source=path.join(dir,'photo.png');await command('magick',['-size','96x64','gradient:red-blue','-depth','8',source]);
 for(const format of ['webp','jxl']){
  if(format==='jxl'&&!(await capabilities()).image.jxl)continue;
  const report=await compress([source],{format,lossless:true,output:path.join(dir,'out')});assert.equal(report.assets[0].status,'done',report.assets[0].reason);
  let decoded=path.join(report.directory,report.assets[0].outputs[0].file);
  if(format==='jxl'){const target=path.join(dir,'decoded.png');await command('djxl',[decoded,target]);decoded=target;const again=await compress([path.join(report.directory,report.assets[0].outputs[0].file)],{output:path.join(dir,'out')});assert.equal(again.assets[0].status,'done',again.assets[0].reason);}
  const originalPixels=await command('magick',[source,'-format','%#','info:']);const outputPixels=await command('magick',[decoded,'-format','%#','info:']);assert.equal(outputPixels,originalPixels);
 }
 if((await capabilities()).image.jxl){const gif=path.join(dir,'animation.gif'),jxl=path.join(dir,'animation.jxl');await command('magick',['-size','32x32','xc:red','-size','32x32','xc:blue','-loop','0',gif]);await command('cjxl',[gif,jxl]);const report=await compress([jxl],{output:path.join(dir,'out')});assert.equal(report.assets[0].status,'error');assert.match(report.assets[0].reason,/Animated JPEG XL/);}
});
test('destination presets retain upload motion and use platform-friendly image outputs',async t=>{
 const dir=await fixture(t);const video=path.join(dir,'source.mov');await command('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=128x96:rate=60','-t','0.2','-c:v','libx264',video]);
 const report=await compress([video],{destination:'youtube',output:path.join(dir,'out')});assert.equal(report.assets[0].status,'done',report.assets[0].reason);
 const probe=JSON.parse(await command('ffprobe',['-v','error','-show_streams','-of','json',path.join(report.directory,report.assets[0].outputs[0].file)]));assert.equal(evalFraction(probe.streams[0].avg_frame_rate),60);
 const photo=path.join(dir,'photo.jpg');await command('magick',['-size','1600x2000','gradient:red-blue',photo]);
 const instagram=await compress([photo],{destination:'instagram',output:path.join(dir,'out')});assert.equal(instagram.assets[0].status,'done');assert.equal(instagram.assets[0].outputs[0].width,1080);assert.equal(instagram.assets[0].outputs[0].height,1350);assert.ok(instagram.assets[0].outputs[0].file.endsWith('.jpg'));
 const app=await compress([photo],{destination:'app',output:path.join(dir,'out')});assert.equal(app.assets[0].outputs[0].width,1600);assert.equal(app.assets[0].outputs[0].height,2000);
});
test('video HEVC, VP9, AV1 and preserve codec/container outputs decode correctly',async t=>{
 const {capabilities}=await import('../dist/engine.js');const caps=await capabilities();const dir=await fixture(t);const source=path.join(dir,'clip.mov');await command('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=128x96:rate=30','-t','0.2','-c:v','libx264',source]);
 for(const [videoFormat,expected] of [['hevc','hevc'],['vp9','vp9'],['av1','av1'],['preserve','h264']]){
  if(videoFormat!=='preserve'&&!caps.video[videoFormat])continue;
  const report=await compress([source],{videoFormat,output:path.join(dir,'out')});assert.equal(report.assets[0].status,'done',report.assets[0].reason);
  const output=path.join(report.directory,report.assets[0].outputs[0].file);const probe=JSON.parse(await command('ffprobe',['-v','error','-show_streams','-of','json',output]));assert.equal(probe.streams[0].codec_name,expected);
  await command('ffmpeg',['-v','error','-i',output,'-f','null','-']);if(videoFormat==='preserve')assert.ok(output.endsWith('.mov'));
 }
});
test('custom output may share the input directory; generated batches are not reprocessed',async t=>{
 const dir=await fixture(t);const source=path.join(dir,'image.jpg');await command('magick',['-size','32x32','xc:red',source]);
 const first=await compress([dir],{output:dir});assert.equal(first.assets.length,1);assert.equal(first.assets[0].status,'done');
 const second=await compress([dir],{output:dir});assert.equal(second.assets.length,1);assert.equal(second.assets[0].source,source);assert.notEqual(second.directory,first.directory);
});
