# Live Chat Grid

[YouTube Live](https://www.youtube.com/live) と[ニコニコ生放送](https://live.nicovideo.jp/)のチャットを抽出して、グリッドレイアウトで表示する Chrome 拡張機能です。両方のチャットを一つのウインドウに同時に表示出来ます。

一度表示したチャットはスクロールせず同じ位置に表示し続けるので、テキストを読んでいる途中でテキストの位置がスクロールで上下に動くことはありません。新しいチャットは一番古いチャット位置に順次上書きされます。

## インストール

- ターミナルを開く
- ビルドする(要 `node`, `git`)

```sh
git clone https://github.com/susumuota/livechatgrid.git
cd livechatgrid
npm ci
npm run build
```

- Chrome 拡張機能の設定ページを開く `chrome://extensions`
- `デベロッパー モード` を ON にする
- `パッケージ化されていない拡張機能を読み込む` をクリック
- ビルドした `dist` フォルダを指定する `/path/to/livechatgrid/dist`


## 使い方

- YouTube Live `https://www.youtube.com/watch/v=*` または ニコニコ生放送 `https://live.nicovideo.jp/watch/lv*` のページを開く
- 右クリックしてコンテキストメニューを開き、`Live Chat Grid` を選択すると別ウインドウを表示しライブチャットを表示
  - さらに、このウインドウで `F12` キーを押して DevTools を表示すると、過去のチャットログを表示できます。ログの種類で `Verbose` と `Info` をそれぞれ有効にしてください。
- チャットが更新されないときは元ページをリロード
- それでもダメなら拡張機能の設定ページで更新を押してから元ページをリロード

## 設定

`Live Chat Grid` のウインドウで `F12` キーを押して DevTools を表示し、以下のコードを入力して設定を行います。
詳細は [common.ts](https://github.com/susumuota/livechatgrid/blob/main/src/common.ts) を参照してください。以下設定例です。

### チャットを横 5 列, 縦 15 行のグリッドで表示

`columns` で列、 `rows` に行を指定します。

```javascript
chrome.storage.local.set({ columns: 5, rows: 15 })
```

上記設定後に、スクロールバーが消えるようにウインドウサイズをマウスで調整してください。フォントサイズは通常通り `Command+-` と `Command+=` で調整出来ます。

### 個々のチャット欄の高さを 3 行にする

`rowHeight` に `(行数 * 1.5 + 2)rem` を文字列で指定(1.5 は line-height, 2 は padding)。はみ出た分はマウスホバーすると表示出来ます。

```javascript
chrome.storage.local.set({ rowHeight: '6.5rem' })
```

### チャット全体を表示

`rowHeight` に `auto` を指定するとチャット全体を表示出来ますが、グリッドの高さがメッセージによって変わるのでテキストの位置がずれます。

```javascript
chrome.storage.local.set({ rowHeight: 'auto' })
```

### 固定グリッド表示をやめる

`isFixedGrid` を `false` にすると、固定グリッドをやめてチャットをスクロールさせます。 `rows` を多めに設定出来ます。スクロールバーの一番下までスクロールした状態だと自動スクロールします。

```javascript
chrome.storage.local.set({ isFixedGrid: false, rows: 20 })
```

### 機能を停止

`isEnabled` を `false` にした後に元ページをリロードすると、チャットの抽出を停止します。

```javascript
chrome.storage.local.set({ isEnabled: false })
```

## ソースコード

https://github.com/susumuota/livechatgrid

## 作者

Susumu OTA
