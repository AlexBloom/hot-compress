// A tiny original synthetic CFA DNG: no external camera photo or network dependency.
export function syntheticDng(){
 const width=64,height=64;
 const ascii=s=>Buffer.from(s+'\0');
 const short=values=>{const b=Buffer.alloc(values.length*2);values.forEach((v,i)=>b.writeUInt16LE(v,i*2));return b;};
 const long=values=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v,i*4));return b;};
 const rational=(values,signed=false)=>{const b=Buffer.alloc(values.length*8);values.forEach((v,i)=>{b.writeInt32LE(v,i*8);b.writeInt32LE(1,i*8+4);});return b;};
 const tags=[
  [256,4,1,long([width])],[257,4,1,long([height])],[258,3,1,short([16])],
  [259,3,1,short([1])],[262,3,1,short([32803])],[271,2,4,ascii('Hot')],
  [272,2,10,ascii('Synthetic')],[273,4,1,long([0])],[274,3,1,short([1])],
  [277,3,1,short([1])],[278,4,1,long([height])],[279,4,1,long([width*height*2])],
  [284,3,1,short([1])],[33421,3,2,short([2,2])],[33422,1,4,Buffer.from([0,1,1,2])],
  [50706,1,4,Buffer.from([1,4,0,0])],[50707,1,4,Buffer.from([1,1,0,0])],
  [50708,2,14,ascii('Hot Synthetic')],[50714,5,1,rational([0])],[50717,4,1,long([65535])],
  [50721,10,9,rational([1,0,0,0,1,0,0,0,1],true)],
  [50728,5,3,rational([1,1,1])],[50778,3,1,short([21])],
 ].sort((a,b)=>a[0]-b[0]);
 let offset=8+2+tags.length*12+4;for(const tag of tags)if(tag[3].length>4)offset+=(tag[3].length+1)&~1;
 const pixels=offset;tags.find(t=>t[0]===273)[3]=long([pixels]);
 const output=Buffer.alloc(pixels+width*height*2);output.write('II');output.writeUInt16LE(42,2);output.writeUInt32LE(8,4);output.writeUInt16LE(tags.length,8);
 offset=8+2+tags.length*12+4;
 tags.forEach(([id,type,count,data],index)=>{const position=10+index*12;output.writeUInt16LE(id,position);output.writeUInt16LE(type,position+2);output.writeUInt32LE(count,position+4);if(data.length<=4)data.copy(output,position+8);else{output.writeUInt32LE(offset,position+8);data.copy(output,offset);offset+=(data.length+1)&~1;}});
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)output.writeUInt16LE(12000+((x+y)%16)*500,pixels+(y*width+x)*2);
 return output;
}
