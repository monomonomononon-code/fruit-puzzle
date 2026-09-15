import { writeFileSync, mkdirSync } from 'node:fs';
import * as current from '../src/engine.js';
import { LEVELS } from '../src/levels.js';
import { cleanSave } from '../src/storage.js';
import { playMove, useStock, stockUsable, stockPairs, collectClear, stockTotal } from '../src/stock.js';
const baseline = await import('../tests/fixtures/v06/engine.js');
const oldLevels = (await import('../tests/fixtures/v06/levels.js')).LEVELS;
const runs = Number(process.env.SIM_RUNS || 100);
const conditions = process.env.SIM_CONDITION ? [process.env.SIM_CONDITION] : ['baseline','shape','stock','proactive'];
const all = {};
mkdirSync('test-results',{recursive:true});
for (const condition of conditions) {
  const stats = LEVELS.map(l => ({ level:l.id, runs, clears:0, actions:0, waves:0, moves:0, normalMoves:0, observations:0, shuffles:0, shuffledRuns:0, stockUses:0, stockRuns:0, flightRescues:0, endingStock:0, maxStock:0 }));
  for (let run=1;run<=runs;run++) {
    const save=cleanSave(null,20);
    if (condition==='shape') save.stock={delivery:0,line:0,rainbow:0};
    for (let id=1;id<=20;id++) {
      const api=condition==='baseline'?baseline:current;
      const game=new api.Game((condition==='baseline'?oldLevels:LEVELS)[id-1],api.seeded(run*100003+id*997));
      const rng=api.seeded(run*713+id*17), s=stats[id-1];let shuffled=false,used=false;
      for(let step=0;step<1500&&!game.complete();step++) {
        const moves=api.validMoves(game.board);
        s.observations++;s.moves+=moves.length;s.normalMoves+=moves.filter(([a,b])=>!game.board[a].special&&!game.board[b].special).length;
        let result;
        const stockCondition=['stock','proactive'].includes(condition);
        if(stockCondition&&stockUsable(game,save)&&(!moves.length || condition==='proactive'&&step<3)) {
          const kind=['delivery','line','rainbow'].find(k=>save.stock[k]);
          const pairs=stockPairs(game), pair=pairs[Math.floor(rng()*pairs.length)];
          result=useStock(game,save,kind,...pair);if(result.valid){s.stockUses++;used=true;}
        } else if(moves.length) {
          const pair=moves[Math.floor(rng()*moves.length)];
          result=condition==='baseline'?game.play(...pair,{noShuffle:true}):playMove(game,save,...pair);
          if(condition==='baseline'&&result.valid&&!game.complete()&&!api.validMoves(game.board).length){game.reshuffle();result.events.push({type:'shuffle'});}
        } else {game.reshuffle();s.shuffles++;shuffled=true;continue;}
        if(!result.valid)continue;
        s.actions++;s.waves+=result.events.filter(e=>e.type==='clear').length;
        const n=result.events.filter(e=>e.type==='shuffle').length;s.shuffles+=n;shuffled ||= n>0;
        s.flightRescues+=result.events.filter(e=>e.type==='flight-rescue').length;
      }
      if(game.complete()){s.clears++;if(['stock','proactive'].includes(condition))collectClear(game,save,20);}
      s.shuffledRuns+=Number(shuffled);s.stockRuns+=Number(used);s.endingStock+=stockTotal(save);s.maxStock=Math.max(s.maxStock,stockTotal(save));
    }
    writeFileSync(`test-results/simulation-${condition}-progress.json`,JSON.stringify({run,stats}));
    if(run%5===0)console.log(`${condition} ${run}/${runs}`);
  }
  all[condition]=stats;
  writeFileSync(`test-results/stock-simulation-${condition}.json`,JSON.stringify({runs,policy:'Uniform random legal board move; random legal stock placement. stock=deadlocks only; proactive=first three actions or deadlocks. Persistent campaign inventory, first-clear rewards, 1500 action cap. Same seed per level/run, trajectories diverge after changes.',conditions:all},null,2));
}
console.log('Simulation complete');
