// script.js
// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
//  設定エリア
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
const usersBtn = document.getElementById('users-btn');
const usersModal = document.getElementById('users-modal');
const closeUsersBtn = document.getElementById('close-users-btn');
const usersList = document.getElementById('users-list');

let currentUser = null;
let unsubscribeMsg = null;
let unsubscribeUsers = null;

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

        try {
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error("Error updating user info:", e);
        }

        loginScreen.style.opacity = '0';
        setTimeout(() => {
            loginScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
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
        if (unsubscribeUsers) unsubscribeUsers();
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

msgInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value.trim() !== '') {
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-50');
    } else {
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-50');
    }
});
sendBtn.disabled = true;

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

// --- 時刻フォーマット ---
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date();
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// --- ★追加: 日付フォーマット（区切り線用） ---
function formatDateLabel(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date();
    // 例: 2023年11月29日
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

// --- メッセージ読み込みと表示 ---
function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    unsubscribeMsg = onSnapshot(q, (snapshot) => {
        msgContainer.innerHTML = '';
        
        let lastUid = null;
        let lastDateString = null; // ★追加: 前回の日付文字列を保持

        snapshot.forEach((doc) => {
            const data = doc.data();
            const currentDateString = formatDateLabel(data.createdAt); // このメッセージの日付
            
            // ★追加: 日付が変わったら区切り線を表示
            if (currentDateString !== lastDateString) {
                const dateDivider = document.createElement('div');
                dateDivider.className = "flex justify-center my-6 fade-in";
                dateDivider.innerHTML = `
                    <span class="bg-slate-200/80 text-slate-500 text-xs px-3 py-1 rounded-full shadow-sm">
                        ${currentDateString}
                    </span>
                `;
                msgContainer.appendChild(dateDivider);
                
                lastDateString = currentDateString; // 日付を更新
                lastUid = null; // 日付が変わったら連続投稿扱いしない（アイコンを出すため）
            }

            // --- ここから通常のメッセージ表示 ---
            const isMyMessage = data.uid === currentUser.uid;
            const isContinuous = data.uid === lastUid;
            const timeString = formatTime(data.createdAt);

            const msgRow = document.createElement('div');
            msgRow.className = `flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'} ${isContinuous ? 'mt-1' : 'mt-4'} fade-in`;

            if (isMyMessage) {
                // 自分
                msgRow.innerHTML = `
                    <div class="max-w-[75%]">
                        <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm shadow-sm text-sm leading-relaxed break-words">
                            ${escapeHTML(data.text).replace(/\n/g, '<br>')}
                        </div>
                        <div class="text-[10px] text-slate-400 text-right mt-1 mr-1">
                            ${timeString}
                        </div>
                    </div>
                `;
            } else {
                // 相手
                msgRow.innerHTML = `
                    <div class="flex items-end gap-2 max-w-[85%]">
                        ${!isContinuous ? `<img src="${data.photoURL}" class="w-8 h-8 rounded-full shadow-sm mb-6 bg-slate-200 object-cover">` : '<div class="w-8"></div>'}
                        <div>
                            ${!isContinuous ? `<div class="text-[11px] text-slate-500 ml-1 mb-1">${escapeHTML(data.displayName)}</div>` : ''}
                            <div class="bg-white text-slate-800 border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm text-sm leading-relaxed break-words">
                                ${escapeHTML(data.text).replace(/\n/g, '<br>')}
                            </div>
                            <div class="text-[10px] text-slate-400 ml-1 mt-1">
                                ${timeString}
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

// --- ユーザー一覧機能 ---
usersBtn.addEventListener('click', () => {
    usersModal.classList.remove('hidden');
    usersModal.classList.add('flex');
    loadUsers();
});

closeUsersBtn.addEventListener('click', () => {
    usersModal.classList.add('hidden');
    usersModal.classList.remove('flex');
    if(unsubscribeUsers) {
        unsubscribeUsers();
        unsubscribeUsers = null;
    }
});

usersModal.addEventListener('click', (e) => {
    if (e.target === usersModal) {
        closeUsersBtn.click();
    }
});

function loadUsers() {
    if(unsubscribeUsers) return;

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
                        ${isMe ? '<span class="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">あなた</span>' : ''}
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