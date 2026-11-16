import {useEffect,useRef,useState,type ReactNode,type DragEvent} from 'react';
import {ImageIcon,FileVideo,Loader2,LayoutGrid} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {api,token} from '@/lib/api';
import type {Options} from '../../src/engine';
export type MediaEntry={id:string;name:string;bytes:number;kind:'image'|'video'|'file'};
type Sample={before:string;after:string;width:number;height:number;outputWidth:number;outputHeight:number;bytes:number;format:string;warnings:string[];note:string};
const positions=[{label:'Top left',x:0,y:0},{label:'Top right',x:1,y:0},{label:'Center',x:.5,y:.5},{label:'Bottom left',x:0,y:1},{label:'Bottom right',x:1,y:1}];
function Tile({entry,wb,selected,onSelect}:{entry:MediaEntry;wb:string;selected:boolean;onSelect:()=>void}){
 const [failed,setFailed]=useState(false);const delay=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(delay.current),[]);
 const name=entry.name.split('/').pop()!;
 return <button className="thumbnail-card" data-selected={selected} onClick={onSelect} onFocus={onSelect} onMouseEnter={()=>{delay.current=setTimeout(onSelect,180);}} onMouseLeave={()=>clearTimeout(delay.current)} aria-label={`Preview ${entry.name}`} aria-pressed={selected}>
 <span className="thumbnail-image checkerboard">{!failed?<img loading="lazy" decoding="async" src={`/api/media/${entry.id}/thumbnail?wb=${wb}&token=${encodeURIComponent(token)}`} alt="" onError={()=>setFailed(true)}/>:entry.kind==='video'?<FileVideo/>:<ImageIcon/>}{entry.kind==='video'&&<span className="media-type">Video</span>}</span><span className="thumbnail-name" title={entry.name}>{name}</span><span className="thumbnail-size">{(entry.bytes/1000).toFixed(0)} KB{failed?' · No thumbnail':''}</span></button>;
}
export function MediaCanvas({entries,total,loading,options,onDrop,onChoose,children}:{entries:MediaEntry[];total:number;loading:boolean;options:Options;onDrop:(event:DragEvent)=>void;onChoose:()=>void;children?:ReactNode}){
 const [selected,setSelected]=useState(''),[region,setRegion]=useState(2),[sample,setSample]=useState<Sample>(),[pending,setPending]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!entries.some(entry=>entry.id===selected)){setSelected(entries[0]?.id||'');setRegion(2);}},[entries,selected]);
 const {output:_output,responsive:_responsive,widths:_widths,sizes:_sizes,...previewOptions}=options;const settingsKey=JSON.stringify(previewOptions),regionKey=JSON.stringify(positions[region]);
 useEffect(()=>{
  setSample(undefined);setError('');if(!selected){setPending(false);return;}
  setPending(true);const controller=new AbortController();let current=true;
  const delay=setTimeout(()=>{void api<Sample>(`/api/media/${selected}/preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({options:JSON.parse(settingsKey),region:JSON.parse(regionKey)}),signal:controller.signal}).then(value=>{if(current)setSample(value);}).catch(err=>{if(current&&!controller.signal.aborted)setError(err.message);}).finally(()=>{if(current)setPending(false);});},350);
  return()=>{current=false;clearTimeout(delay);controller.abort();};
 },[selected,settingsKey,regionKey]);
 const entry=entries.find(item=>item.id===selected);const imageUrl=(id:string)=>`/api/preview-assets/${id}?token=${encodeURIComponent(token)}`;
 return <section className="media-canvas" aria-label="Media canvas" onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
 <div className="canvas-toolbar"><div className="flex items-center gap-2"><LayoutGrid className="size-3.5"/><h1>Media</h1><Badge variant="secondary">{total} files</Badge></div>{loading&&<span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin"/>Loading files</span>}</div>
 <div className="canvas-scroll">{!entries.length?<div className="canvas-empty"><ImageIcon className="size-8 text-muted-foreground"/><p>{loading?'Preparing thumbnails…':'Drop files to preview'}</p><Button variant="outline" size="sm" onClick={onChoose} disabled={loading}>Choose files</Button></div>:<>
 <div className="thumbnail-grid">{entries.map(item=><Tile key={`${item.id}-${options.rawWhiteBalance||'camera'}`} entry={item} wb={options.rawWhiteBalance||'camera'} selected={item.id===selected} onSelect={()=>setSelected(item.id)}/>)}</div>{total>entries.length&&<p className="text-xs text-muted-foreground">Showing the first {entries.length} of {total} files. Export includes the whole folder.</p>}
 <section className="comparison-panel" aria-label="Before and after preview"><div className="comparison-header"><div><h2 title={entry?.name}>{entry?.name.split('/').pop()}</h2><p>{sample?`${sample.outputWidth} × ${sample.outputHeight} · ${sample.format} · ${(sample.bytes/1000).toFixed(1)} KB`:'Selected settings'}</p></div>{pending&&<span className="flex items-center gap-2 text-xs"><Loader2 className="size-3 animate-spin"/>Rendering</span>}</div>
 <div className="crop-controls"><span>Crop</span>{positions.map((position,index)=><Button key={position.label} size="sm" variant={region===index?'secondary':'ghost'} aria-pressed={region===index} onClick={()=>setRegion(index)}>{position.label}</Button>)}</div>
 {error?<p role="status" className="preview-error">{error}</p>:<div className="comparison-grid">{['Before','After'].map((label,index)=><figure key={label}><figcaption>{label}{index===0&&<span> · at export size</span>}</figcaption><div className="comparison-image checkerboard">{sample?<img src={imageUrl(index===0?sample.before:sample.after)} width={sample.width} height={sample.height} alt={`${label} crop of ${entry?.name}`} draggable={false}/>:<Loader2 className="size-5 animate-spin text-muted-foreground"/>}</div></figure>)}</div>}
 {sample&&<><p className="comparison-note">{sample.width} × {sample.height} crop · {sample.note}</p>{sample.warnings.map(warning=><p key={warning} className="comparison-note">{warning}</p>)}</>}
 </section></>}{children}</div><div className="canvas-status">{entries.length?'Hover or select a thumbnail to compare settings.':'JPEG, PNG, HEIC, RAW, video and more.'}</div></section>;
}
