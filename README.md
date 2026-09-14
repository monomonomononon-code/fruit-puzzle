# 果実日和 — Fruitful

時間も手数も気にせず遊べる、果物の2D **3マッチパズル**です。

- **ターン制限なし・制限時間なし**。自分のペースで収穫できます。
- 6種類の果物。4個消しで十字、5個消しでライン、6個以上で虹の特殊アイテムを生成し、特殊同士の組み合わせも楽しめます。
- 氷、ダンボール箱、埋まりマス（石畳）の3種類の障害物。
- **10レベル収録**。レベル選択と段階的な解放に対応。
- **PC・スマホ対応**。クリック、タップ、スワイプ、キーボードで操作できます。
- **localStorageによる進行保存**。最高到達レベル、クリア済みレベル、設定を保存します。

HTML / CSS / JavaScriptで構成し、実行時の外部ライブラリやビルドは不要です。

リポジトリ：[monomonomonomonomononon-code/fruit-puzzle](https://github.com/monomonomonomonomononon-code/fruit-puzzle)

## 最初に遊ぶ

**必要なもの：Node.js 20以上とChrome等のブラウザ。** 開発に使用したCodex環境ではNode.jsが利用可能で、追加インストールは不要です。

リポジトリをダウンロードして展開するか、Gitで取得します：

```sh
git clone https://github.com/monomonomonomonomononon-code/fruit-puzzle.git
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

## 操作

- 隣り合う2つの果物をクリック/タップ。またはスワイプ。
- 同じ果物が縦か横に3つ以上そろう交換だけ成立します。
- キーボード：矢印でフォーカス移動、Enter/Spaceで選択、Escapeで選択解除。
- 4個で十字、5個で縦/横ライン、6個以上で虹を生成。特殊同士の交換で合成。
- 氷は隣接消去1回、箱は2回で開きます。特殊直撃も有効。石畳は永久ブロック。
- 目標がすべて達成されると、次のレベルが開きます。
- 「ヒント」は何回でも無料。「やり直す」は現在のレベルだけをリセット。
- 設定で効果音と動きの軽減を変更できます。音は最初OFFです。

最高到達レベル、クリア済みレベル、設定は同じブラウザのlocalStorageに保存されます。途中の盤面は保存しません。別ブラウザ・別オリジン（プロトコル・ホスト・ポート）・別端末とは共有されません。ブラウザのサイトデータを削除すると記録も消えます。

## ファイルの役割

| ファイル | 変更する内容 |
|---|---|
| `PLAN.md` | 開発環境、技術選定、作業計画 |
| `SPEC.md` | 詳細ルールと特殊の組み合わせ |
| `AGENTS.md` | 今後AIに変更を頼む際の開発ルール |
| `src/levels.js` | レベル名、クリア要求、障害物の配置 |
| `src/engine.js` | マッチ、消去、特殊、落下、シャッフル |
| `src/app.js` | UI、入力、アニメーション、画面遷移 |
| `src/art.js` | 自作SVGの6種類の果物 |
| `src/storage.js` | 保存データの検証 |
| `style.css` | 色、サイズ、余白、スマホレイアウト |
| `tests/engine.test.mjs` | ルールの自動テスト |
| `scripts/browser-test.mjs` | Chromeでの自動操作テスト |
| `TEST_REPORT.md` | 検証結果と制約 |

## レベルを増やす

`src/levels.js` の `LEVELS` に定義を追加します。盤面のセル番号は0〜63（左上0、右下63）。`セル番号 = 行 × 8 + 列`、行と列は0始まりです。

例：

```js
stage(11, '新しい果樹園', 'のんびり、大きな収穫を。',
  [fruit(0, 45), fruit(2, 35), ice(4)],
  [18, 21, 42, 45], // 氷
  [],                // 箱
  [0, 7, 56, 63]     // 埋まりマス
)
```

同じセルに障害物を重ねず、氷や箱の目標数は配置数以下にします。消せない孤立領域を作らないよう、障害物の周囲に十分な交換スペースを残してください。現在のレベル数を固定したテストの期待値も更新し、シード付き自動プレイで新しいレベルの到達性を確認します。盤面サイズの変更はエンジンとUIの両方を変更する必要があります。

## テスト

ロジックはNode.jsだけで検証できます：

```powershell
node --test tests/engine.test.mjs
```

ブラウザテストは、サーバーを起動した状態で別ターミナルから：

```powershell
node scripts/browser-test.mjs
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

通常の公開先は `https://monomonomonomonomononon-code.github.io/fruit-puzzle/` です。これは公開設定後の予定URLで、公開済みリンクではありません。公開に必要なのは `index.html`、`style.css`、`src/`、`.nojekyll` です。

設定方法は[GitHub公式ドキュメント](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)を確認しています。Pages上での実配信確認は公開後に行ってください。

## 含めないファイル

`.gitignore` により、`node_modules/`、`test-results/`、Playwrightレポート、`dist/`、`coverage/`、ログ、一時ファイル、`.env`、エディター・OSのローカル設定を除外しています。ローカルのテスト画像は削除せず、リポジトリへの反映対象から外します。

## 開発単位

1. 環境確認・設計：AGENTS / PLAN / SPEC。
2. ゲームルール：データ駆動レベル、独立エンジン、セーブ検証。
3. 画面：自作素材、レスポンシブUI、入力、演出、設定。
4. 品質確認：31件のロジックテスト、Chrome操作、検証記録と起動手順。
