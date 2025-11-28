// script.js
// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// ★ doc, setDoc を追加
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
//  設定エリア (ここを書き換えてください)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCY9Lzf8ooRT6-yfjG8yP8nNxMYba45BmE",
  authDomain: "gdgschuo-chat.firebaseapp.com",
  projectId: "gdgschuo-chat",
  storageBucket: "gdgschuo-chat.firebasestorage.app",
  messagingSenderId: "25562541212",
  appId: "1:25562541212:web:c2c7dcc68e0a672e7f9159"
};

// ==========================================
//  初期化とロジック
// ==========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const sendBtn = document.getElementById('send-btn');
const msgInput = document.getElementById('message-input');
const msgContainer = document.getElementById('messages-container');

// ★追加: ユーザー一覧用エレメント
const usersBtn = document.getElementById('users-btn');
const usersModal = document.getElementById('users-modal');
const closeUsersBtn = document.getElementById('close-users-btn');
const usersList = document.getElementById('users-list');

let currentUser = null;
let unsubscribeMsg = null; // メッセージリスナー解除用
let unsubscribeUsers = null; // ユーザーリスナー解除用

// --- ログイン処理 ---
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed", error);
    }
});

// --- ログアウト処理 ---
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- 認証状態の監視 ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;

        // ★追加: ログイン時にユーザー情報をFirestoreに保存/更新
        try {
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: serverTimestamp() // 最終ログイン日時
            }, { merge: true }); // 既存データがあればマージ（上書き）
        } catch (e) {
            console.error("Error updating user info:", e);
        }

        // 画面切り替え（フェードアウト効果）
        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
            // 少し遅らせてフェードイン
            setTimeout(() => chatScreen.style.opacity = '1', 50);
        }, 500);
        
        loadMessages();
    } else {
        currentUser = null;
        chatScreen.style.opacity = '0';
        setTimeout(() => {
            chatScreen.style.display = 'none';
            loginScreen.style.display = 'flex';
            setTimeout(() => loginScreen.style.opacity = '1', 50);
        }, 500);

        if (unsubscribeMsg) unsubscribeMsg();
        if (unsubscribeUsers) unsubscribeUsers(); // ★追加: ユーザー監視も解除
        msgContainer.innerHTML = '';
    }
});

// --- メッセージ送信 ---
sendBtn.addEventListener('click', sendMessage);

msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 入力欄の高さ自動調整
msgInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    // 空文字チェック
    if(this.value.trim() !== '') {
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-50');
    } else {
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-50');
    }
});
sendBtn.disabled = true; // 初期状態

async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || !currentUser) return;

    sendBtn.disabled = true;
    
    try {
        await addDoc(collection(db, "messages"), {
            text: text,
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        
        msgInput.value = '';
        msgInput.style.height = 'auto';
    } catch (error) {
        console.error("Error sending message: ", error);
        alert("送信できませんでした");
        sendBtn.disabled = false;
    }
}

// --- メッセージ読み込みと表示 ---
function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    unsubscribeMsg = onSnapshot(q, (snapshot) => {
        msgContainer.innerHTML = '';
        
        let lastUid = null; // 連続投稿チェック用

        snapshot.forEach((doc) => {
            const data = doc.data();
            const isMyMessage = data.uid === currentUser.uid;
            const isContinuous = data.uid === lastUid;

            // コンテナ
            const msgRow = document.createElement('div');
            msgRow.className = `flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'} ${isContinuous ? 'mt-1' : 'mt-4'} fade-in`;

            // HTML生成
            if (isMyMessage) {
                // === 自分のメッセージ ===
                msgRow.innerHTML = `
                    <div class="max-w-[75%]">
                        <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm shadow-sm text-sm leading-relaxed break-words">
                            ${escapeHTML(data.text).replace(/\n/g, '<br>')}
                        </div>
                        ${!isContinuous ? `<div class="text-[10px] text-slate-400 text-right mt-1 mr-1">Just now</div>` : ''}
                    </div>
                `;
            } else {
                // === 相手のメッセージ ===
                msgRow.innerHTML = `
                    <div class="flex items-end gap-2 max-w-[85%]">
                        ${!isContinuous ? `<img src="${data.photoURL}" class="w-8 h-8 rounded-full shadow-sm mb-1 bg-slate-200 object-cover">` : '<div class="w-8"></div>'}
                        <div>
                            ${!isContinuous ? `<div class="text-[11px] text-slate-500 ml-1 mb-1">${escapeHTML(data.displayName)}</div>` : ''}
                            <div class="bg-white text-slate-800 border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm text-sm leading-relaxed break-words">
                                ${escapeHTML(data.text).replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    </div>
                `;
            }

            msgContainer.appendChild(msgRow);
            lastUid = data.uid;
        });

        scrollToBottom();
    });
}

// --- ★追加: ユーザー一覧機能 ---
usersBtn.addEventListener('click', () => {
    usersModal.classList.remove('hidden');
    usersModal.classList.add('flex');
    loadUsers(); // 開いたときに読み込み開始
});

closeUsersBtn.addEventListener('click', () => {
    usersModal.classList.add('hidden');
    usersModal.classList.remove('flex');
    if(unsubscribeUsers) {
        unsubscribeUsers(); // 閉じたら監視解除（通信節約）
        unsubscribeUsers = null;
    }
});

// モーダル外側クリックで閉じる
usersModal.addEventListener('click', (e) => {
    if (e.target === usersModal) {
        closeUsersBtn.click();
    }
});

function loadUsers() {
    // 既に監視中なら何もしない
    if(unsubscribeUsers) return;

    // 最終ログイン順（新しい順）で取得
    const q = query(collection(db, "users"), orderBy("lastLogin", "desc"));

    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        usersList.innerHTML = '';
        snapshot.forEach((doc) => {
            const user = doc.data();
            const isMe = user.uid === currentUser.uid;
            
            const userItem = document.createElement('div');
            userItem.className = "flex items-center gap-3 p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition";
            userItem.innerHTML = `
                <img src="${user.photoURL}" class="w-10 h-10 rounded-full bg-slate-200 object-cover border border-slate-200">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 flex items-center gap-2">
                        ${escapeHTML(user.displayName)}
                        ${isMe ? '<span class="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">You</span>' : ''}
                    </div>
                </div>
            `;
            usersList.appendChild(userItem);
        });
    });
}

function scrollToBottom() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}