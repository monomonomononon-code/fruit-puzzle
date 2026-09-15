# 果実日和 — Fruitful

時間も手数も気にせず遊べる、果物の2D **3マッチパズル**です。

- **ターン制限なし・制限時間なし**。自分のペースで収穫できます。
- 6種類の果物。4個消しでおとどけ、5個消しでライン、6個以上で虹の特殊アイテムを生成し、生成後は果物属性のない独立アイテム。隣の果物と交換するだけで発動し、特殊同士の合成も楽しめます。
- 氷、ダンボール箱、埋まりマス（石畳）に加え、マス間の壁と回り込み落下。
- **最大11×9の自由形状**。未使用マスは盤面の外で、毎回99マスを使う仕様ではありません。
- 同色の**2×2正方形も4マッチ**になり、おとどけアイテムが生まれます。
- **20レベル収録**。Lv1〜20を可変盤面向けに再調整。小さな長方形から、穴あき・左右分断・細道・リング・非対称の庭へ。
- **PC・スマホ対応、スマホは横向き推奨**。左に目標、中央に盤面、右に操作を配置。縦向きも引き続き遊べます。クリック、タップ、スワイプ、キーボードに対応。
- フルーツ消去時に `assets/audio/fruit-clear.mp3` を再生。設定画面の「効果音」でON/OFFを保存します。
- **localStorageによる進行保存**。最高到達レベル、クリア済みレベル、設定、アイテム在庫、ステージ別使用回数を保存します。

- **持ちものストック**：初回クリア時に未使用の特殊を回収。合計6個まで、1ステージ3個まで使用できます。初期はおとどけ1＋ライン1。右の「持ちもの」から選び、通常フルーツを隣へ交換して発動。取消は同ボタンまたはEsc。

HTML / CSS / JavaScriptで構成し、実行時の外部ライブラリやビルドは不要です。

リポジトリ：[monomonomononon-code/fruit-puzzle](https://github.com/monomonomononon-code/fruit-puzzle)

## 最初に遊ぶ

**必要なもの：Node.js 20以上とChrome等のブラウザ。** 開発に使用したCodex環境ではNode.jsが利用可能で、追加インストールは不要です。

リポジトリをダウンロードして展開するか、Gitで取得します：

```sh
git clone https://github.com/monomonomononon-code/fruit-puzzle.git
cd fruit-puzzle
node scripts/serve.mjs
```

Windowsでは、次の方法でも起動できます。

1. このフォルダの `start.cmd` をダブルクリックします。
2. ブラウザで **http://localhost:4173** を開きます。
3. 遊び終わったらサーバーのウィンドウで Ctrl+C を押します。

Codex が起動したサーバーが既に動いている場合は、手順2だけで遊べます。`EADDRINUSE` は同じポートで既に起動中という意味です。

コマンドで起動する場合：

```powershell
node scripts/serve.mjs
```

別のPCでは Node.js 20以上が必要です。ゲーム自体に npm、Phaser、Vite などのインストールは必要ありません。`index.html` を直接ダブルクリックする方法は ES Modules と保存の動作が不安定になるため、上記のサーバーで開いてください。

4マッチのおとどけは飛んで1果物を収穫。通常は未達成目標を優先し、通常手ゼロなら着地後に動ける候補を試算します。見つからず完全手詰まりになる場合だけラインを残します。詳細は [おとどけ仕様](docs/FLIGHT_UPDATE.md)。

## 操作

- 隣り合う2つの果物をクリック/タップ。またはスワイプ。
- 同じ果物が縦か横に3つ以上、または2×2にそろう交換が成立します。壁を挟む交換はできません。
- キーボード：矢印でフォーカス移動、Enter/Spaceで選択、Escapeで選択解除。
- 4個でおとどけ、5個で縦/横ライン、6個以上で虹を生成。ラインは左右交換で横、上下交換で縦に発動。特殊同士の交換で合成。
- 氷は隣接消去1回、箱は2回で開きます。特殊直撃も有効。石畳は永久ブロック。
- 目標がすべて達成されると、次のレベルが開きます。
- 通常マッチがなくても特殊を使えるなら続行。完全に有効手がない場合だけシャッフルします。
- 「ヒント」は何回でも無料。「やり直す」は現在のレベルだけをリセット。
- 設定で効果音と動きの軽減を変更できます。音は最初OFFです。

最高到達レベル、クリア済みレベル、設定は同じブラウザのlocalStorageに保存されます。途中の盤面は保存しません。別ブラウザ・別オリジン（プロトコル・ホスト・ポート）・別端末とは共有されません。ブラウザのサイトデータを削除すると記録も消えます。

## ファイルの役割

旧版でLv10をクリア済みなら、新版の初回起動でLv11が開きます。回転だけでは盤面も進捗もリセットされません。今回の更新内容・配置規則は [独立アイテム設計](docs/ITEM_UPDATE.md) と [可変盤面・壁・落下設計](docs/BOARD_UPDATE.md) にまとめています。水流ギミックは将来案で、今回は実装していません。

| ファイル | 変更する内容 |
|---|---|
| `PLAN.md` | 開発環境、技術選定、作業計画 |
| `SPEC.md` | 詳細ルールと特殊の組み合わせ |
| `AGENTS.md` | 今後AIに変更を頼む際の開発ルール |
| `src/levels.js` | レベル名、クリア要求、障害物の配置 |
| `src/level-layout.js` | 文字マップの変換と構造検査 |
| `src/topology.js` | 可変サイズ、座標、壁、地形の共有処理 |
| `src/engine.js` | マッチ、消去、特殊、落下、シャッフル |
| `src/app.js` | UI、入力、アニメーション、画面遷移 |
| `src/art.js` | 自作SVGの6種類の果物 |
| `src/storage.js` | 保存データの検証 |
| `style.css` | 色、サイズ、余白、スマホレイアウト |
| `landscape.css` | スマホ横向きの左右パネル・盤面サイズ |
| `tests/engine.test.mjs` / `tests/board.test.mjs` / `tests/items.test.mjs` / `tests/flow.test.mjs tests/flight.test.mjs` | 既存ルールと新しい盤面の自動テスト |
| `scripts/browser-test.mjs` | Chromeでの自動操作テスト |
| `scripts/board-browser-test.mjs` | 全20面のサイズ・壁・2×2・曲がる落下演出 |
| `scripts/landscape-test.mjs` | 横向き・回転・旧セーブからの進行検証 |
| `TEST_REPORT.md` | 検証結果と制約 |

## レベルを増やす

`src/levels.js` の `LEVELS` に以下の形式で追加します。幅は文字数、高さは行数で決まり、最大11列×9行です。セル番号は `行 × 幅 + 列`（0始まり）。

```js
mappedStage(21, '新しい果樹園', 'のんびり、大きな収穫を。', '小さな庭',
  [{ key: 'fruit0', count: 25 }, { key: 'ice', count: 1 }], [
    '.......',
    '..i....',
    '..._...',
    '.......',
    '.......',
  ], [[8, 15]]) // この2マスの間に壁
```

文字は ` . `=果物、`_`=存在しない空間、`#`=永久ブロック、`i`=氷、`b`=箱です。壁は最後の引数に隣接マス番号のペアを並べます。例のような小さい外枠も、11×9内の大きな欠けた形も定義できます。最大範囲内の寸法変更にはエンジンやUIの編集は不要です。

読み込み時に寸法・孤立セル・壁・障害物の開放経路・目標数を検査します。各領域には壁のない2×3以上の交換スペースを残してください。形状を変えたら、検査に加えて乱数を固定した自動プレイで全目標への到達を確認してください。特殊攻撃は壁を越えて届きます。

通常落下の後、真下が塞がれた果物は空いた左側→下、右側→下の順に回り込みます。中継マスや辺が塞がれていれば移動しません。空洞下の空きには左右の既存果物が流れ込み、空きが供給列へ伝わって上から補充されます。左右からも供給できない孤立区間だけは、その場所の補充口を使用します。

## テスト

ロジックはNode.jsだけで検証できます：

```powershell
node --test tests/engine.test.mjs tests/board.test.mjs tests/items.test.mjs tests/flow.test.mjs
```

ブラウザテストは、サーバーを起動した状態で別ターミナルから：

```powershell
node scripts/browser-test.mjs
node scripts/landscape-test.mjs
node scripts/board-browser-test.mjs
node scripts/items-browser-test.mjs
node scripts/flow-browser-test.mjs
node scripts/flight-browser-test.mjs
```

このCodex環境では同梱PlaywrightとChromeを自動検出します。他のPCでは `npm install --save-dev playwright` が必要です。Chromiumだけを利用する場合はテストの `channel: 'chrome'` を削除し、`npx playwright install chromium` で検証用ブラウザを用意できます。テストは隔離されたブラウザ保存領域で動くため、普段の進行データを消しません。

`test-results/` にPC・スマホ・Lv10の画像とJSONレポートを出力します。通常URLではQA用APIは無効です。`?test=1` を付けた開発用URLでのみ固定盤面の注入が可能です。

## GitHub Pagesへの配置

**GitHub Pagesで公開できる静的構成です。この反映作業ではPagesの公開設定は変更していません。**

`index.html` をルートに配置し、CSS・JavaScriptを相対パスで読み込むため、`/fruit-puzzle/` のようなサブディレクトリでも動作します。`.nojekyll` を同梱し、ビルド・バックエンド・環境変数は不要です。

公開する際の設定：

1. リポジトリの **Settings → Pages** を開きます。
2. **Source: Deploy from a branch** を選びます。
3. **Branch: main / Folder: / (root)** を指定して **Save** します。
4. デプロイ完了後、Pages設定画面に表示されるURLを開きます。

最小完成版は [GitHub Pages](https://monomonomononon-code.github.io/fruit-puzzle/) と [Vercel](https://fruit-puzzle-psi.vercel.app/) で公開済みです。今回の独立アイテム更新はローカル検証までで、公開サイトへの反映は行っていません。配信には index.html、style.css、landscape.css、src/、.nojekyll を含めてください。

設定方法は[GitHub公式ドキュメント](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)を確認しています。Pages上での実配信確認は公開後に行ってください。

## 含めないファイル

`.gitignore` により、`node_modules/`、`test-results/`、Playwrightレポート、`dist/`、`coverage/`、ログ、一時ファイル、`.env`、エディター・OSのローカル設定を除外しています。ローカルのテスト画像は削除せず、リポジトリへの反映対象から外します。

## 開発単位

1. 環境確認・設計：AGENTS / PLAN / SPEC。
2. ゲームルール：データ駆動レベル、独立エンジン、セーブ検証。
3. 画面：自作素材、レスポンシブUI、入力、演出、設定。
4. 品質確認：既存ルールの回帰と新しい盤面ルールのロジックテスト、Chrome操作、検証記録と起動手順。
5. 横向き更新：高さに合わせるUI、10種類の追加マップ、構造検査、保存互換と回転テスト。

6. 盤面拡張：最大11×9・無効空間・壁・回り込み落下・2×2、全20面再調整。

7. 独立アイテム：果物属性なし、全特殊のスワップ発動、ライン方向、最終手段としてのシャッフル。虹との合成は最多果物が対象（同数は一覧順）。

## v0.7の比較検証
[仕様と変更点](docs/STOCK_UPDATE.md) / [Lv1〜20のバランス評価](docs/STOCK_BALANCE_REPORT.md)

`node --test tests/*.test.mjs` でルール検証、`node scripts/stock-browser-test.mjs` でストックの画面操作、`node scripts/simulate-stock.mjs` で4条件×各レベル100回の比較を実行できます。比較用の過去ソースは tests/fixtures/v06 に固定しています。
