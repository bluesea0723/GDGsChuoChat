// script.js
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

// チャンネルリスト
const AVAILABLE_ROOMS = [
    { id: 'general', name: 'General' },
    { id: 'tech', name: 'Tech' },
    { id: 'event', name: 'Event' },
    { id: 'marketing', name: 'Marketing' }
];

// ==========================================
//  初期化
// ==========================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const sendBtn = document.getElementById('send-btn');
const msgInput = document.getElementById('message-input');
const msgContainer = document.getElementById('messages-container');
const usersBtn = document.getElementById('users-btn');
const usersModal = document.getElementById('users-modal');
const closeUsersBtn = document.getElementById('close-users-btn');
const usersList = document.getElementById('users-list');

// Sidebar Elements
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const roomListEl = document.getElementById('room-list');
const currentRoomNameEl = document.getElementById('current-room-name');

let currentUser = null;
let currentRoomId = 'general';
let unsubscribeMsg = null;
let unsubscribeUsers = null;

// --- 初期化 ---
renderRoomList();

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
        }, 500);
        
        loadMessages(currentRoomId);
    } else {
        currentUser = null;
        loginScreen.style.display = 'flex';
        setTimeout(() => loginScreen.style.opacity = '1', 50);

        if (unsubscribeMsg) unsubscribeMsg();
        if (unsubscribeUsers) unsubscribeUsers();
        msgContainer.innerHTML = '';
        
        closeSidebar();
    }
});

// --- サイドバー制御 ---
function renderRoomList() {
    roomListEl.innerHTML = '';
    AVAILABLE_ROOMS.forEach(room => {
        const btn = document.createElement('button');
        const isActive = room.id === currentRoomId;
        
        btn.className = `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm ${
            isActive ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
        }`;
        
        btn.innerHTML = `
            <span class="opacity-50 text-lg leading-none">#</span>
            <span>${room.name}</span>
        `;
        
        btn.onclick = () => switchRoom(room);
        roomListEl.appendChild(btn);
    });
    
    const currentRoom = AVAILABLE_ROOMS.find(r => r.id === currentRoomId);
    if(currentRoom) {
        currentRoomNameEl.innerHTML = `<span class="text-slate-400">#</span> ${currentRoom.name}`;
    }
}

function switchRoom(room) {
    if (currentRoomId === room.id) return;
    
    currentRoomId = room.id;
    renderRoomList();
    closeSidebar();
    loadMessages(room.id);
}

// モバイル用メニュー開閉
menuBtn.addEventListener('click', () => {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    sidebarOverlay.classList.remove('hidden');
});

function closeSidebar() {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    sidebarOverlay.classList.add('hidden');
}

closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);


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
        await addDoc(collection(db, "rooms", currentRoomId, "messages"), {
            text: text,
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        
        msgInput.value = '';
        msgInput.style.height = 'auto';
        msgInput.focus();
    } catch (error) {
        console.error("Error sending message: ", error);
        alert("送信できませんでした");
        sendBtn.disabled = false;
    }
}

// --- フォーマット関数 ---
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date();
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date();
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

// --- メッセージ読み込み (Slack/Discordスタイル) ---
function loadMessages(roomId) {
    if (unsubscribeMsg) {
        unsubscribeMsg();
        unsubscribeMsg = null;
    }

    msgContainer.innerHTML = '';
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = "text-center text-slate-400 text-sm mt-4";
    loadingDiv.innerText = "読み込み中...";
    msgContainer.appendChild(loadingDiv);

    const q = query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "asc"));
    
    unsubscribeMsg = onSnapshot(q, (snapshot) => {
        msgContainer.innerHTML = '';
        
        let lastUid = null;
        let lastDateString = null;
        
        if (snapshot.empty) {
            msgContainer.innerHTML = `<div class="text-center text-slate-400 text-sm mt-10"># ${AVAILABLE_ROOMS.find(r => r.id === roomId).name} へようこそ！<br>最初のメッセージを投稿しましょう。</div>`;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const currentDateString = formatDateLabel(data.createdAt);
            
            // 日付区切り線
            if (currentDateString !== lastDateString) {
                const dateDivider = document.createElement('div');
                dateDivider.className = "relative flex items-center justify-center my-6";
                dateDivider.innerHTML = `
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-slate-200"></div>
                    </div>
                    <span class="relative bg-slate-50 px-4 text-xs font-bold text-slate-400 border border-slate-200 rounded-full py-0.5">
                        ${currentDateString}
                    </span>
                `;
                msgContainer.appendChild(dateDivider);
                lastDateString = currentDateString;
                lastUid = null; // 日付が変わったらヘッダーを出し直す
            }

            // 連続投稿の判定 (同じユーザーかつ時間が1分以内ならまとめる等のロジックも可能だが、今回はシンプルにUID一致で判定)
            const isContinuous = data.uid === lastUid;
            const timeString = formatTime(data.createdAt);

            const msgRow = document.createElement('div');
            // Slackライクな行デザイン (全メッセージ左寄せ)
            msgRow.className = `flex gap-3 px-2 py-1 hover:bg-slate-100 transition rounded-lg group ${isContinuous ? 'mt-0' : 'mt-2'}`;

            if (!isContinuous) {
                // === 新しい投稿ブロック（アイコン＋名前＋メッセージ） ===
                msgRow.innerHTML = `
                    <div class="shrink-0 pt-1">
                        <img src="${data.photoURL}" class="w-9 h-9 rounded-md bg-slate-200 object-cover shadow-sm cursor-pointer hover:opacity-80">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                            <span class="font-bold text-slate-700 text-sm cursor-pointer hover:underline">${escapeHTML(data.displayName)}</span>
                            <span class="text-[10px] text-slate-400">${timeString}</span>
                        </div>
                        <div class="text-slate-800 text-[15px] leading-relaxed break-words whitespace-pre-wrap mt-0.5">${escapeHTML(data.text)}</div>
                    </div>
                `;
            } else {
                // === 連続投稿（左側のスペースを空けてメッセージのみ表示、時刻はホバーで表示したいが今回は簡易的に左横に配置） ===
                msgRow.innerHTML = `
                    <div class="w-9 shrink-0 text-[10px] text-slate-300 text-right opacity-0 group-hover:opacity-100 select-none pt-1.5 pr-1">
                        ${timeString}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-slate-800 text-[15px] leading-relaxed break-words whitespace-pre-wrap">${escapeHTML(data.text)}</div>
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
            userItem.className = "flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition cursor-pointer";
            
            userItem.innerHTML = `
                <img src="${user.photoURL}" class="w-8 h-8 rounded-md bg-slate-200 object-cover border border-slate-200 shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <span class="truncate">${escapeHTML(user.displayName)}</span>
                        ${isMe ? '<span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs">あなた</span>' : ''}
                    </div>
                </div>
                <div class="w-2 h-2 bg-green-400 rounded-full"></div>
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