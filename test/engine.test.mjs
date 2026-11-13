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
 assert.throws(()=>validateOptions({format:'jpeg'}));assert.throws(()=>validateOptions({widths:[NaN]}));
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
