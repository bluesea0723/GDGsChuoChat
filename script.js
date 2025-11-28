// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } 
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

let currentUser = null;
let unsubscribe = null; // リアルタイムリスナー解除用

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
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
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

        if (unsubscribe) unsubscribe();
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
    
    unsubscribe = onSnapshot(q, (snapshot) => {
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
                // === 自分のメッセージ (青背景・白文字) ===
                msgRow.innerHTML = `
                    <div class="max-w-[75%]">
                        <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm shadow-sm text-sm leading-relaxed break-words">
                            ${escapeHTML(data.text).replace(/\n/g, '<br>')}
                        </div>
                        ${!isContinuous ? `<div class="text-[10px] text-slate-400 text-right mt-1 mr-1">Just now</div>` : ''}
                    </div>
                `;
            } else {
                // === 相手のメッセージ (白背景・黒文字) ===
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