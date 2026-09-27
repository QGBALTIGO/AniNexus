import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const run=process.argv[2]||'baseline-guest',width=Number(process.argv[3]||390),theme=process.argv[4]||'dark';
const root='audit-artifacts',rows=(await fs.readFile(`${root}/${run}/results.jsonl`,'utf8')).trim().split('\n').map(JSON.parse).filter(x=>x.width===width&&x.theme===theme);
const cellW=width>=1024?600:300,cellH=width>=1024?480:660,cols=width>=1024?2:4,perPage=cols*2;
await fs.mkdir(`${root}/sheets`,{recursive:true});
for(let offset=0;offset<rows.length;offset+=perPage){
  const cells=[];
  for(const [i,row] of rows.slice(offset,offset+perPage).entries()){
    const source=sharp(path.join(root,row.screenshot)),meta=await source.metadata();
    const thumb=await source.extract({left:0,top:0,width:meta.width,height:Math.min(meta.height,row.height)}).resize(cellW,cellH-50,{fit:'contain',position:'top',background:'#202024'}).png().toBuffer();
    const label=row.route.replace(/[&<>]/g,'');
    const svg=Buffer.from(`<svg width="${cellW}" height="50"><rect width="100%" height="100%" fill="#303038"/><text x="8" y="20" fill="white" font-size="12" font-family="Arial">${label.slice(0,42)}</text><text x="8" y="39" fill="#c0c0c0" font-size="11" font-family="Arial">${row.role} · ${width}px · ${theme}</text></svg>`);
    const left=(i%cols)*cellW,top=Math.floor(i/cols)*cellH;
    cells.push({input:svg,left,top},{input:thumb,left,top:top+50});
  }
  const file=`${root}/sheets/${run}-${width}-${theme}-${1+offset/perPage}.png`;
  await sharp({create:{width:cols*cellW,height:2*cellH,channels:3,background:'#202024'}}).composite(cells).png().toFile(file);
  console.log(file);
}
