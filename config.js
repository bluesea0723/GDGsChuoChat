// config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// ★追加: Realtime Databaseのインポート
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCY9Lzf8ooRT6-yfjG8yP8nNxMYba45BmE",
  authDomain: "gdgschuo-chat.firebaseapp.com",
  // ★重要: databaseURL が必要になる場合がありますが、v9以降の自動設定で動くことが多いです。
  // もし動かない場合はFirebaseコンソールで確認した databaseURL: "https://xxx.firebasedatabase.app" をここに追加してください。
  projectId: "gdgschuo-chat",
  storageBucket: "gdgschuo-chat.firebasestorage.app",
  messagingSenderId: "25562541212",
  appId: "1:25562541212:web:c2c7dcc68e0a672e7f9159"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// ★追加: Realtime Databaseの初期化とエクスポート
export const rtdb = getDatabase(app);
export const provider = new GoogleAuthProvider();

export const AVAILABLE_CHANNELS = [
    { id: 'general', name: 'General' },
    { id: 'tech', name: 'Tech' },
    { id: 'event', name: 'Event' },
    { id: 'marketing', name: 'Marketing' }
];