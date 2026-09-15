// 設計用の評価。ゲームのレベル・進行・保存は変更しない。
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,seeded,snapshot,findMatches,validMoves,canSwap,movable} from '../src/engine.js';
import {openEdge,neighbors} from '../src/topology.js';
import {LEVELS} from '../src/levels.js';

function analyze(level,covered){
  const g=new Game(level,seeded(1)),b=g.board,w=g.width;
  if(!covered)b.forEach(c=>{c.cover=0;c.coverType=null;});
  const cells=b.flatMap((c,i)=>movable(c)?[i]:[]),open=new Set(cells);
  const edges=cells.flatMap(i=>[i+1,i+w].filter(j=>open.has(j)&&openEdge(b,i,j)).map(j=>[i,j]));
  const patterns=[],dirs=new Map(cells.map(i=>[i,new Set()]));
  for(const i of cells){
    for(const [step,dir] of [[1,'H'],[w,'V']]){
      const p=[i,i+step,i+2*step];
      if(p.every(j=>open.has(j))&&openEdge(b,p[0],p[1])&&openEdge(b,p[1],p[2])){patterns.push(p);p.forEach(j=>dirs.get(j).add(dir));}
    }
    const p=[i,i+1,i+w,i+w+1];
    if(p.every(j=>open.has(j))&&[[0,1],[0,2],[1,3],[2,3]].every(([a,c])=>openEdge(b,p[a],p[c])))patterns.push(p);
  }
  const symbolic=snapshot(b);cells.forEach(i=>symbolic[i].fruit=100+i);
  const potential=edges.filter(([a,c])=>[[a,c],[c,a]].some(([from,to])=>patterns.some(p=>{
    if(!p.includes(to)||p.includes(from))return false;
    const t=snapshot(symbolic);p.forEach(i=>t[i].fruit=0);t[to].fruit=1;t[from].fruit=0;
    return !findMatches(t).length&&canSwap(t,from,to);
  }))).length;
  const components=(removed=-1)=>{
    const unseen=new Set(cells.filter(i=>i!==removed)),parts=[];
    while(unseen.size){const queue=[unseen.values().next().value];unseen.delete(queue[0]);
      for(const i of queue)for(const j of neighbors(i,b))if(openEdge(b,i,j)&&unseen.delete(j))queue.push(j);
      parts.push(queue.length);
    }return parts;
  };
  const parts=components();const cut=cells.filter(i=>components(i).length>parts.length).length;
  const widths=cells.map(i=>{
    const span=step=>{let n=1;for(const sign of [-1,1])for(let j=i;open.has(j+sign*step)&&openEdge(b,j,j+sign*step);j+=sign*step)n++;return n;};
    return Math.min(span(1),span(w));
  });
  const counts=[];let zero=0;
  for(let seed=1;seed<=200;seed++){
    const rng=seeded(seed*491),t=snapshot(b);cells.forEach(i=>t[i].fruit=null);
    for(const i of cells){const colors=[0,1,2,3,4,5];for(let k=5;k>0;k--){const j=Math.floor(rng()*(k+1));[colors[k],colors[j]]=[colors[j],colors[k]];}
      for(const color of colors){t[i].fruit=color;if(!findMatches(t).some(p=>p.includes(i)))break;}
    }
    if(findMatches(t).length)throw new Error('unstable sample');
    const n=validMoves(t).length;counts.push(n);if(!n)zero++;
  }
  return {cells:cells.length,edges:edges.length,potential,threeHorizontal:patterns.filter(p=>p.length===3&&p[1]-p[0]===1).length,threeVertical:patterns.filter(p=>p.length===3&&p[1]-p[0]===w).length,squares:patterns.filter(p=>p.length===4).length,bothDirections:cells.filter(i=>dirs.get(i).size===2).length,narrow:widths.filter(n=>n<=2).length,oneWide:widths.filter(n=>n===1).length,components:parts,articulations:cut,meanMoves:counts.reduce((a,b)=>a+b,0)/counts.length,zeroSamples:zero,samples:counts.length};
}
const results=[];
for(const level of LEVELS){const r={id:level.id,name:level.name,shape:level.shape,open:analyze(level,false),start:analyze(level,true)};results.push(r);console.log(`Lv${r.id}: ${r.open.meanMoves.toFixed(2)}手 / ゼロ${r.open.zeroSamples}/200、開始時${r.start.meanMoves.toFixed(2)}手 / ゼロ${r.start.zeroSamples}/200`);}
await mkdir('docs',{recursive:true});await writeFile('docs/shape-metrics.json',JSON.stringify({method:'200 seeds; no initial matches; no valid-move conditioning; six normal fruits; shape and initial covers separately',results},null,2));
