import {readFileSync,writeFileSync} from 'node:fs';
const names={baseline:'変更前',shape:'形状調整のみ',stock:'形状＋手詰まり時ストック',proactive:'形状＋積極使用'};
const data=Object.fromEntries(Object.keys(names).map(c=>[c,JSON.parse(readFileSync(`test-results/stock-simulation-${c}.json`)).conditions[c]]));
if(Object.values(data).some(rows=>rows.length!==20||rows.some(r=>r.runs!==100)))throw new Error('Report requires 100 runs per level');
const avg=(a,b)=> (a/b).toFixed(2), pct=(a,b)=>(100*a/b).toFixed(1)+'%';
const aggregate=rows=>rows.reduce((a,r)=>{for(const [k,v] of Object.entries(r))if(typeof v==='number')a[k]=(a[k]??0)+v;return a;},{});
let md=`# Lv1〜20 ストック・盤面バランス評価（v0.7）\n\n## 方法\n各条件100キャンペーン×20面、4条件で合計8,000ステージ。条件間で同じシードを使用。通常操作は有効手から乱択。ストックは種類順おとどけ→ライン→虹、置く場所・交換方向は合法候補から乱択。各レベル1500操作で打切り。\n\n「手詰まり時ストック」は盤面内の通常手・特殊手が両方ないときだけ使用。「積極使用」は各面の最初の3操作でも在庫があれば使用。どちらもLv1開始時の2個と初回クリア回収だけで、レベルごとの無料補充なし。合計6・種類別3/2/1・1面3個を共通処理で制限。\n\n平均有効手は各操作前の盤面内合法スワップ数（特殊発動も含む）。ストックの配置候補は含めない。平均通常手は特殊を含まないマッチ成立交換数。シャッフル率は100操作あたりの回数、発生ステージ率は1回以上シャッフルした試行の割合。ストック使用率は1個以上使ったステージの割合。「消去波」は連鎖1段を1回、操作数は有効スワップ／ストック確定を1回として区別する。\n\n## 全体\n|条件|クリア|平均有効手|平均通常手|シャッフル/100操作|発生ステージ率|ストック使用率|平均消去波/面|平均操作/面|\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for(const [c,rows]of Object.entries(data)){const s=aggregate(rows);md+=`|${names[c]}|${s.clears}/${s.runs}|${avg(s.moves,s.observations)}|${avg(s.normalMoves,s.observations)}|${avg(s.shuffles*100,s.actions)}|${pct(s.shuffledRuns,s.runs)}|${pct(s.stockRuns,s.runs)}|${avg(s.waves,s.runs)}|${avg(s.actions,s.runs)}|\n`;}
md+='\n## 各レベル（各行100試行）\n';
for(const [c,rows]of Object.entries(data)){
 md+=`\n### ${names[c]}\n|Lv|クリア|平均有効手|シャッフル/100操作|発生ステージ率|ストック使用率|使用個数/面|平均消去波|平均操作|\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
 for(const s of rows)md+=`|${s.level}|${s.clears}/100|${avg(s.moves,s.observations)}|${avg(s.shuffles*100,s.actions)}|${pct(s.shuffledRuns,s.runs)}|${pct(s.stockRuns,s.runs)}|${avg(s.stockUses,s.runs)}|${avg(s.waves,s.runs)}|${avg(s.actions,s.runs)}|\n`;
}
md+='\n## 在庫と既存の飛行救済\n|条件|使用個数/面|面終了後の平均在庫|最大在庫|飛行でのライン付与回数|\n|---|---:|---:|---:|---:|\n';
for(const c of ['stock','proactive']){const s=aggregate(data[c]);md+=`|${names[c]}|${avg(s.stockUses,s.runs)}|${avg(s.endingStock,s.runs)}|${Math.max(...data[c].map(r=>r.maxStock))}|${s.flightRescues}|\n`;}
md+='\n## 構造の変化\n障害物込みの診断用200盤面（即時マッチなし、手の有無では選別しない）で比較。実ゲームの初期手は保証されるため、このゼロ手率を実ゲームの開始失敗率とはしない。\n\n|Lv|開始時平均通常手 旧→新|ゼロ手/200 旧→新|縦横両方向セル 旧→新|幅2以下セル 旧→新|関節点 旧→新|\n|---|---:|---:|---:|---:|---:|\n';
const old=JSON.parse(readFileSync('tests/fixtures/v06/shape-metrics.json')).results,now=JSON.parse(readFileSync('docs/shape-metrics.json')).results;
for(const id of [8,17,18]){const a=old[id-1].start,b=now[id-1].start;md+=`|${id}|${a.meanMoves.toFixed(2)}→${b.meanMoves.toFixed(2)}|${a.zeroSamples}→${b.zeroSamples}|${a.bothDirections}→${b.bothDirections}|${a.narrow}→${b.narrow}|${a.articulations}→${b.articulations}|\n`;}
md+='\n## 判断と次の調整候補\n- 今回は合計6個・1面3個を維持する。全8,000試行が打切りなしでクリア。変更前→手詰まり時ストックでシャッフル/100操作は5.87→4.07（約31%減）、平均消去波は70.90→70.36（約0.8%減）。消去工程を大きく短絡する傾向はない。\n- 形状だけでも5.87→4.64に改善し、ストック追加で4.07になる。主な改善は形状、ストックは残った局面への選択肢として働く。積極使用4.58より手詰まり時使用4.07が良く、温存する意味が残る。\n- Lv8のシャッフル/面は4.27→1.41、Lv17は7.73→2.24、Lv18は15.69→8.71。Lv18は改善してもまだ頻繁。ストック上限を増やすより、今後は下側2マス幅や障害物周辺を再評価する。今回の結果を「手詰まり解消済み」とは扱わない。\n- 手詰まり時方策の面終了後平均在庫は0.67個、最大5個。積極使用では平均0.31個、最大4個。乱択では特殊を早く使うため在庫が少なくなりやすい。上限6個の温存熟練プレイが強すぎないことまで検証したわけではない。上限の強制自体は固定テストで確認。\n- 平均有効手にはストック待機中の0手も含む。自動シャッフル条件は次の観測前に再配置されるので、条件間の平均手数だけで難易度を断定しない。構造診断とシャッフル率を併用する。\n';
md+='\n## 検証の限界\n乱択プレイは目標を先読みする人間や、特殊を意識的に温存するプレイヤーとは異なる。各100回は調整材料であり、詰みの数学的な不可能性や最適なストック戦略の強さを証明しない。盤面変更・アイテム使用で乱数消費と展開が変わり、同じシードでも途中盤面は一致しない。シャッフルと既存おとどけ救済は残している。実ブラウザではLv8・17・18各最大15手に加え、各1回をクリアまで操作。ストック選択・取消・発動・保存・クリア表示も確認した。実機スマホの長期プレイではない。\n';
md+='\n## Chromeでのクリア通し確認\nLv8→17→18の順に在庫を引き継ぎ、画面の果物と持ちものボタンを実クリック。各1試行なので率の推定には使わない。Lv8は32操作・ストック0個・シャッフル0回、Lv17は71操作・3個・1回、Lv18は57操作・0個・5回でクリア。Lv17で3個を使い切っても4個目を使わず救済に進み、Lv18へ消費が引き継がれることを確認した。再現用はscripts/stock-stage-play.mjs。\n';
writeFileSync('docs/STOCK_BALANCE_REPORT.md',md);writeFileSync('docs/stock-simulation.json',JSON.stringify({runs:100,conditions:data},null,2));
console.log(md.split('## 各レベル')[0]);
