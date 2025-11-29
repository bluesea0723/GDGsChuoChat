# GDGsChuo Chat

## 概要

Firebase Authentication / Firestore / Realtime Database を用いたブラウザ向けチャットアプリです。  
Google アカウントでログインし、チャンネルチャット・DM・スレッド返信・オンライン状態表示を行います。

---

## 構成 (Project Structure)

```text
.
├─ index.html        # 画面のベースレイアウトと各コンポーネントのコンテナ
├─ style.css         # 共通スタイル、スクロールバー、アニメーションなど
├─ config.js         # Firebase 初期化と AVAILABLE_CHANNELS の定義
├─ main.js           # エントリーポイント。認証・画面切り替え・初期化処理
├─ store.js          # currentUser / currentRoomId / userCache の簡易ストア
├─ sidebar.js        # チャンネル一覧・DM一覧・オンラインインジケータ
├─ chat.js           # メインチャットの送受信、スレッド表示・投稿
├─ presence.js       # Realtime Database を使ったプレゼンス管理
└─ utils.js          # 日時フォーマット、HTML エスケープ、スクロール処理
