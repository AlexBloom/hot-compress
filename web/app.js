const $ = id => document.getElementById(id);
const token = location.hash.slice(1) || sessionStorage.getItem('hot-token') || '';
if (location.hash) {sessionStorage.setItem('hot-token',token);history.replaceState(null,'',location.pathname);}
let selected = [], running = false;
const bytes = n => n < 1e6 ? `${(n/1000).toFixed(1)} KB` : `${(n/1e6).toFixed(2)} MB`;
async function api(url, options={}) {
  const res=await fetch(url,{...options,headers:{'x-hot-token':token,...options.headers}});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Request failed');return data;
}
function selection(files){selected=files;$('directory').value='';$('selection').textContent=`${files.length} file${files.length===1?'':'s'} selected · ${bytes(files.reduce((n,f)=>n+f.file.size,0))}. Originals stay intact.`;}
$('choose').onclick=()=>$('files').click();$('choose-folder').onclick=()=>$('folder').click();
for(const id of ['files','folder'])$(id).onchange=e=>selection([...e.target.files].map(file=>({file,name:file.webkitRelativePath||file.name})));
$('clear').onclick=()=>{if(running)return;selected=[];$('directory').value='';$('files').value='';$('folder').value='';$('selection').textContent='No files selected. Your originals always stay intact.';};
$('directory').oninput=()=>{selected=[];$('selection').textContent='The selected directory will be scanned recursively.';};
$('responsive').onchange=()=>$('responsive-settings').hidden=!$('responsive').checked;
async function traverse(entry,prefix='') {
  if(entry.isFile)return await new Promise((resolve,reject)=>entry.file(file=>resolve([{file,name:prefix+file.name}]),reject));
  if(entry.isDirectory){const reader=entry.createReader();let all=[];for(;;){const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!batch.length)break;for(const child of batch)all.push(...await traverse(child,prefix+entry.name+'/'));}return all;}return [];
}
$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('over');};
$('drop').ondragleave=()=>$('drop').classList.remove('over');
$('drop').ondrop=async e=>{e.preventDefault();$('drop').classList.remove('over');if(running)return;try{const items=[...e.dataTransfer.items];const entries=items.map(i=>i.webkitGetAsEntry?.()).filter(Boolean);selection(entries.length ? (await Promise.all(entries.map(entry=>traverse(entry)))).flat() : [...e.dataTransfer.files].map(file=>({file,name:file.name})));}catch(err){showError(err);}};
function showError(err){$('status').hidden=false;$('status-title').textContent='That batch needs a look.';$('status-detail').textContent=err.message;}
function link(job,file){return `/api/jobs/${job}/download?file=${encodeURIComponent(file)}&token=${encodeURIComponent(token)}`;}
function render(job,report){
  const errors=report.assets.filter(a=>a.status!=='done').length;
  $('status-title').textContent=errors?'Finished, with files to review.':'A little lighter. Ready for the web.';
  const percent=report.inputBytes?Math.round(report.savedBytes/report.inputBytes*100):0;
  $('summary').textContent=`${report.assets.filter(a=>a.status==='done').length} optimized · ${bytes(report.inputBytes)} → ${bytes(report.outputBytes)}${percent>=0?` · ${percent}% lighter`:' · output is larger; review before use'}${report.options.responsive?' (includes all responsive variants)':''}`;
  $('status-detail').textContent=`Saved to ${report.directory}`;
  $('results').replaceChildren();
  for(const asset of report.assets){const row=document.createElement('div');row.className='result';const details=document.createElement('div');const name=document.createElement('strong');name.textContent=asset.source.split('/').pop();const note=document.createElement('small');note.textContent=asset.reason || `${bytes(asset.inputBytes)} → ${bytes(asset.outputs.reduce((n,o)=>n+o.bytes,0))} · ${asset.recommendation}`;details.append(name,note);row.append(details);const links=document.createElement('div');for(const output of asset.outputs){const a=document.createElement('a');a.textContent=`${output.width} × ${output.height} ↗`;a.href=link(job,output.file);links.append(a,document.createElement('br'));}row.append(links);$('results').append(row);}
  $('download').href=`/api/jobs/${job}/zip?token=${encodeURIComponent(token)}`;$('download').hidden=false;
}
$('compress').onclick=async()=>{
  if(running)return;
  const directory=$('directory').value.trim();
  if(!directory&&!selected.length){showError(new Error('Choose files, drop a folder, or enter a directory path.'));return;}
  running=true;for(const id of ['compress','choose','choose-folder','clear','directory'])$(id).disabled=true;
  $('status').hidden=false;$('download').hidden=true;$('results').replaceChildren();$('summary').textContent='';$('status-title').textContent='Lightening the load…';$('progress').value=0;
  try{
    const ids=[];
    if(!directory)for(const [i,item] of selected.entries()){$('status-detail').textContent=`Preparing ${i+1} of ${selected.length}: ${item.name}`;const data=await api('/api/upload',{method:'POST',headers:{'x-file-name':encodeURIComponent(item.name),'Content-Type':'application/octet-stream'},body:item.file});ids.push(data.id);}
    const {id}=await api('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,directory,options:{preset:$('preset').value,format:$('format').value,responsive:$('responsive').checked,...($('responsive').checked?{widths:$('widths').value.split(',').map(Number),sizes:$('sizes').value}:{})}})});
    for(;;){const job=await api(`/api/jobs/${id}`);if(job.state==='error')throw new Error(job.error);if(job.state==='done'){$('progress').value=100;render(id,job.report);break;}$('progress').value=job.total?job.current/job.total*100:0;$('status-detail').textContent=job.total?`${job.current} of ${job.total} complete · ${job.asset||''}`:'Inspecting and optimizing your media…';await new Promise(resolve=>setTimeout(resolve,800));}
  }catch(err){showError(err);}finally{running=false;for(const id of ['compress','choose','choose-folder','clear','directory'])$(id).disabled=false;}
};
api('/api/doctor').then(checks=>{$('health').textContent=checks.every(c=>c.available)?'Engine ready · ImageMagick + FFmpeg available':`Setup needed: ${checks.filter(c=>!c.available).map(c=>c.tool).join(', ')}. See README for installation.`;}).catch(err=>{$('health').textContent=err.message;});
