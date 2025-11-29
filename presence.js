// presence.js
import { ref, onValue, onDisconnect, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { rtdb } from "./config.js";

export function initPresence(user) {
    if (!user) return;

    // Realtime Database上の自分のステータス置き場
    const myStatusRef = ref(rtdb, '/status/' + user.uid);
    
    // 接続状態自体の監視用パス（Firebaseが用意している特殊なパス）
    const connectedRef = ref(rtdb, '.info/connected');

    onValue(connectedRef, (snapshot) => {
        // 接続が切れていたら何もしない
        if (snapshot.val() === false) {
            return;
        }

        // 1. 切断時（タブ閉じなど）に「offline」と書き込む予約をする
        onDisconnect(myStatusRef).set({
            state: 'offline',
            last_changed: serverTimestamp()
        }).then(() => {
            // 2. 今はつながったので「online」と書き込む
            set(myStatusRef, {
                state: 'online',
                last_changed: serverTimestamp()
            });
        });
    });
}