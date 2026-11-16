import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {PreviewLibrary} from '../dist/previews.js';
import {command} from '../dist/engine.js';
import {serve} from '../dist/server.js';
async function fixture(t){const dir=await mkdtemp(path.join(os.tmpdir(),'hot-previews-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('thumbnails are bounded; selected encoder settings change actual crop output without altering the source',async t=>{
 const dir=await fixture(t),source=path.join(dir,'photo.png');await command('magick',['-size','900x600','plasma:fractal',source]);const original=await readFile(source);
 const library=new PreviewLibrary(path.join(dir,'cache'));const [entry]=await library.register([source]);assert.equal(entry.name,'photo.png');
 const thumb=await library.thumbnail(entry.id);const [w,h]=(await command('magick',['identify','-format','%w %h',thumb])).split(' ').map(Number);assert.ok(w<=280&&h<=200);
 const lower=await library.preview(entry.id,{format:'jpeg',quality:10,maxWidth:800},{x:0,y:0});
 const higher=await library.preview(entry.id,{format:'jpeg',quality:95,maxWidth:800},{x:0,y:0});
 assert.equal(lower.outputWidth,800);assert.equal(lower.width,384);assert.ok(lower.bytes<higher.bytes);
 const lowPixels=await command('magick',[library.file(lower.after),'-format','%#','info:']);const highPixels=await command('magick',[library.file(higher.after),'-format','%#','info:']);assert.notEqual(lowPixels,highPixels);
 assert.equal(await command('magick',[library.file(lower.before),'-format','%#','info:']),await command('magick',[library.file(higher.before),'-format','%#','info:']));
 const corner=await library.preview(entry.id,{format:'jpeg',quality:95,maxWidth:800},{x:1,y:1});assert.notEqual(await command('magick',[library.file(corner.before),'-format','%#','info:']),await command('magick',[library.file(higher.before),'-format','%#','info:']));
 await assert.rejects(library.preview(entry.id,{}, {x:3,y:0}),/Crop position/);await assert.rejects(library.thumbnail('not-known'),/Unknown media/);assert.deepEqual(await readFile(source),original);
 const other=path.join(dir,'notes.txt');await writeFile(other,'Not an image');const [unsupported]=await library.register([other]);assert.equal(unsupported.kind,'file');await assert.rejects(library.thumbnail(unsupported.id),/No thumbnail/);await assert.rejects(library.preview(unsupported.id,{}),/No image preview/);
});
test('RAW preview develops sensor data, PNG preview retains alpha, and video preview is labeled as a sample',async t=>{
 const dir=await fixture(t),library=new PreviewLibrary(path.join(dir,'cache'));const {syntheticDng}=await import('./raw-fixture.mjs');const raw=path.join(dir,'sensor.dng');await writeFile(raw,syntheticDng());
 const alpha=path.join(dir,'alpha.png');await command('magick',['-size','80x60','xc:rgba(30,60,90,0.4)',alpha]);
 const movie=path.join(dir,'clip.mp4');await command('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=128x96:rate=30','-t','2','-c:v','libx264',movie]);
 const entries=await library.register([raw,alpha,movie]);
 const dng=await library.preview(entries[0].id,{format:'preserve'});assert.equal(dng.format,'TIFF');assert.equal(dng.width,64);
 const png=await library.preview(entries[1].id,{format:'jpeg'});assert.equal(png.format,'PNG');const opacity=Number(await command('magick',[library.file(png.after),'-format','%[fx:p{0,0}.a]','info:']));assert.ok(Math.abs(opacity-.4)<.005);
 const video=await library.preview(entries[2].id,{videoCrf:30});assert.match(video.note,/1-second encoded sample/);assert.equal(video.format,'MP4');assert.equal(video.outputWidth,128);
});
test('authenticated library APIs load directories, serve only generated pixels, and retain uploads for repeat exports',async t=>{
 const dir=await fixture(t),source=path.join(dir,'image.png');await command('magick',['-size','64x48','gradient:red-blue',source]);
 const {server,link}=await serve(14319,false);t.after(()=>new Promise(resolve=>server.close(resolve)));const [base,token]=link.split('/#'),headers={'x-hot-token':token};
 assert.equal((await fetch(base+'/api/library',{method:'POST',body:'{}'})).status,403);
 const upload=await(await fetch(base+'/api/upload',{method:'POST',headers:{...headers,'x-file-name':'image.png'},body:await readFile(source)})).json();
 const listing=await(await fetch(base+'/api/library',{method:'POST',headers,body:JSON.stringify({ids:[upload.id]})})).json();assert.equal(listing.entries.length,1);assert.equal(listing.entries[0].name,'image.png');assert.equal(listing.entries[0].path,undefined);
 const id=listing.entries[0].id;assert.equal((await fetch(`${base}/api/media/${id}/thumbnail?token=${token}`)).status,200);
 const preview=await(await fetch(`${base}/api/media/${id}/preview`,{method:'POST',headers,body:JSON.stringify({options:{format:'webp',quality:20}})})).json();assert.equal(preview.format,'WEBP');
 const asset=await fetch(`${base}/api/preview-assets/${preview.after}?token=${token}`);assert.equal(asset.status,200);assert.equal(asset.headers.get('content-type'),'image/png');
 assert.equal((await fetch(`${base}/api/preview-assets/${preview.after}`)).status,403);assert.equal((await fetch(`${base}/api/preview-assets/..%2Fsecret?token=${token}`)).status,404);
 const exportOnce=async()=>{const start=await(await fetch(base+'/api/jobs',{method:'POST',headers,body:JSON.stringify({ids:[upload.id],options:{output:path.join(dir,'out')}})})).json();assert.ok(start.id);let job;for(let i=0;i<100;i++){job=await(await fetch(`${base}/api/jobs/${start.id}`,{headers})).json();if(job.state!=='running')break;await new Promise(r=>setTimeout(r,50));}assert.equal(job.state,'done');assert.equal(job.report.assets[0].status,'done');};
 await exportOnce();await exportOnce();
 assert.equal((await fetch(`${base}/api/media/${id}/preview`,{method:'POST',headers,body:JSON.stringify({options:{format:'png'}})})).status,200);
 const folder=await(await fetch(base+'/api/library',{method:'POST',headers,body:JSON.stringify({directory:dir})})).json();assert.equal(folder.entries.length,1);assert.equal(folder.entries[0].name,'image.png');
});
