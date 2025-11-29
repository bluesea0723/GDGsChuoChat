// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, increment } 
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

// Thread Elements
const threadSidebar = document.getElementById('thread-sidebar');
const closeThreadBtn = document.getElementById('close-thread-btn');
const threadParentMsgEl = document.getElementById('thread-parent-msg');
const threadMsgContainer = document.getElementById('thread-messages-container');
const threadInput = document.getElementById('thread-input');
const threadSendBtn = document.getElementById('thread-send-btn');
const threadRoomNameEl = document.getElementById('thread-room-name');

let currentUser = null;
let currentRoomId = 'general';
let currentThreadParentId = null; 

let unsubscribeMsg = null;
let unsubscribeUsers = null;
let unsubscribeThread = null;

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
        setTimeout(() => loginScreen.style.display = 'none', 500);
        loadMessages(currentRoomId);
    } else {
        currentUser = null;
        loginScreen.style.display = 'flex';
        setTimeout(() => loginScreen.style.opacity = '1', 50);
        if (unsubscribeMsg) unsubscribeMsg();
        if (unsubscribeUsers) unsubscribeUsers();
        if (unsubscribeThread) unsubscribeThread();
        msgContainer.innerHTML = '';
        closeSidebar();
        closeThread();
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
        btn.innerHTML = `<span class="opacity-50 text-lg leading-none">#</span><span>${room.name}</span>`;
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
    closeThread();
    loadMessages(room.id);
}

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


// --- メッセージ送信 (メイン) ---
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
    sendBtn.disabled = this.value.trim() === '';
    sendBtn.classList.toggle('opacity-50', this.value.trim() === '');
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
            createdAt: serverTimestamp(),
            replyCount: 0 
        });
        msgInput.value = '';
        msgInput.style.height = 'auto';
        msgInput.focus();
    } catch (error) {
        console.error("Error sending message: ", error);
        sendBtn.disabled = false;
    }
}

// --- メッセージ読み込み ---
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

function loadMessages(roomId) {
    if (unsubscribeMsg) { unsubscribeMsg(); unsubscribeMsg = null; }
    msgContainer.innerHTML = '';
    
    const q = query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "asc"));
    
    unsubscribeMsg = onSnapshot(q, (snapshot) => {
        msgContainer.innerHTML = '';
        let lastUid = null;
        let lastDateString = null;
        
        if (snapshot.empty) {
            msgContainer.innerHTML = `<div class="text-center text-slate-400 text-sm mt-10"># ${AVAILABLE_ROOMS.find(r => r.id === roomId).name} へようこそ！</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const msgId = docSnap.id;
            const currentDateString = formatDateLabel(data.createdAt);
            const replyCount = data.replyCount || 0;

            if (currentDateString !== lastDateString) {
                const dateDivider = document.createElement('div');
                dateDivider.className = "relative flex items-center justify-center my-4";
                dateDivider.innerHTML = `
                    <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200"></div></div>
                    <span class="relative bg-slate-50 px-4 text-xs font-bold text-slate-400 border border-slate-200 rounded-full py-0.5">${currentDateString}</span>
                `;
                msgContainer.appendChild(dateDivider);
                lastDateString = currentDateString;
                lastUid = null;
            }

            const isContinuous = data.uid === lastUid;
            const timeString = formatTime(data.createdAt);
            
            const msgRow = document.createElement('div');
            msgRow.className = `flex gap-3 px-2 py-1 hover:bg-slate-100 transition rounded-lg group ${isContinuous ? 'mt-0' : 'mt-1'}`;

            const openThreadAction = () => openThread(msgId, data);

            // 返信表示エリア
            const replyIndicator = replyCount > 0 ? `
                <div class="mt-1 flex items-center gap-2 cursor-pointer group/reply" onclick="event.stopPropagation();">
                    <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 hover:bg-white hover:border hover:border-slate-200 hover:shadow-sm border border-transparent transition thread-link">
                        <img src="${data.photoURL}" class="w-4 h-4 rounded-sm opacity-70">
                        <span class="text-xs font-bold text-blue-600">${replyCount}件の返信</span>
                        <span class="text-[10px] text-slate-400 opacity-0 group-hover/reply:opacity-100 transition">最終返信を表示</span>
                    </div>
                </div>
            ` : '';

            if (!isContinuous) {
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
                        ${replyIndicator}
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 flex items-start pt-1">
                        <button class="text-slate-400 hover:text-blue-500 p-1 rounded hover:bg-slate-200 transition reply-btn" title="スレッドで返信">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                            </svg>
                        </button>
                    </div>
                `;
            } else {
                msgRow.innerHTML = `
                    <div class="w-9 shrink-0 text-[10px] text-slate-300 text-right opacity-0 group-hover:opacity-100 select-none pt-1.5 pr-1">
                        ${timeString}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-slate-800 text-[15px] leading-relaxed break-words whitespace-pre-wrap">${escapeHTML(data.text)}</div>
                        ${replyIndicator}
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 flex items-start pt-0">
                        <button class="text-slate-400 hover:text-blue-500 p-1 rounded hover:bg-slate-200 transition reply-btn" title="スレッドで返信">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                            </svg>
                        </button>
                    </div>
                `;
            }

            const btn = msgRow.querySelector('.reply-btn');
            if(btn) btn.onclick = openThreadAction;
            
            const link = msgRow.querySelector('.thread-link');
            if(link) link.onclick = openThreadAction;

            msgContainer.appendChild(msgRow);
            lastUid = data.uid;
        });

        scrollToBottom();
    });
}

// --- スレッド機能 ---
function openThread(messageId, parentData) {
    currentThreadParentId = messageId;
    
    // サイドバー表示
    threadSidebar.classList.remove('translate-x-full');
    threadSidebar.classList.add('translate-x-0');
    
    const room = AVAILABLE_ROOMS.find(r => r.id === currentRoomId);
    threadRoomNameEl.textContent = room ? room.name : '';

    // 親メッセージ表示
    threadParentMsgEl.innerHTML = `
        <div class="flex gap-3">
            <img src="${parentData.photoURL}" class="w-8 h-8 rounded-md bg-slate-200 object-cover mt-1">
            <div>
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-700 text-sm">${escapeHTML(parentData.displayName)}</span>
                    <span class="text-[10px] text-slate-400">${formatTime(parentData.createdAt)}</span>
                </div>
                <div class="text-slate-800 text-sm mt-1">${escapeHTML(parentData.text)}</div>
            </div>
        </div>
    `;

    loadThreadMessages(messageId);
}

function closeThread() {
    threadSidebar.classList.add('translate-x-full');
    threadSidebar.classList.remove('translate-x-0');
    if (unsubscribeThread) {
        unsubscribeThread();
        unsubscribeThread = null;
    }
    currentThreadParentId = null;
}
closeThreadBtn.addEventListener('click', closeThread);

function loadThreadMessages(parentId) {
    if (unsubscribeThread) unsubscribeThread();
    threadMsgContainer.innerHTML = '';

    const q = query(collection(db, "rooms", currentRoomId, "messages", parentId, "thread"), orderBy("createdAt", "asc"));
    
    unsubscribeThread = onSnapshot(q, (snapshot) => {
        threadMsgContainer.innerHTML = '';
        if (snapshot.empty) {
            threadMsgContainer.innerHTML = `<div class="text-center text-xs text-slate-400 mt-4">返信はまだありません</div>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = "flex gap-2 mb-3";
            div.innerHTML = `
                <img src="${data.photoURL}" class="w-7 h-7 rounded-md bg-slate-200 object-cover mt-1">
                <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                        <span class="font-bold text-slate-700 text-xs">${escapeHTML(data.displayName)}</span>
                        <span class="text-[10px] text-slate-400">${formatTime(data.createdAt)}</span>
                    </div>
                    <div class="text-slate-800 text-sm mt-0.5 break-words whitespace-pre-wrap">${escapeHTML(data.text)}</div>
                </div>
            `;
            threadMsgContainer.appendChild(div);
        });
        
        threadMsgContainer.scrollTop = threadMsgContainer.scrollHeight;

        // ★追加: スレッドが開かれたタイミングで、親メッセージの返信数を正しい件数に上書き同期する
        if (parentId) {
            const parentRef = doc(db, "rooms", currentRoomId, "messages", parentId);
            // 実際のスレッドメッセージ数(snapshot.size)で上書き
            updateDoc(parentRef, { replyCount: snapshot.size }).catch(err => {
                console.log("Count sync skipped:", err);
            });
        }
    });
}

// スレッド送信
threadSendBtn.addEventListener('click', sendThreadMessage);
threadInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendThreadMessage();
    }
});

async function sendThreadMessage() {
    const text = threadInput.value.trim();
    if (!text || !currentUser || !currentThreadParentId) return;

    threadSendBtn.disabled = true;
    try {
        await addDoc(collection(db, "rooms", currentRoomId, "messages", currentThreadParentId, "thread"), {
            text: text,
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp()
        });

        const parentRef = doc(db, "rooms", currentRoomId, "messages", currentThreadParentId);
        await updateDoc(parentRef, {
            replyCount: increment(1)
        });

        threadInput.value = '';
    } catch (e) {
        console.error(e);
    }
    threadSendBtn.disabled = false;
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
    if (e.target === usersModal) closeUsersBtn.click();
});

function loadUsers() {
    if(unsubscribeUsers) return;
    const q = query(collection(db, "users"), orderBy("lastLogin", "desc"));
    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        usersList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const isMe = user.uid === currentUser.uid;
            const div = document.createElement('div');
            div.className = "flex items-center gap-3 p-2 bg-slate-50 rounded-lg";
            div.innerHTML = `
                <img src="${user.photoURL}" class="w-8 h-8 rounded-md bg-slate-200 object-cover">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <span class="truncate">${escapeHTML(user.displayName)}</span>
                        ${isMe ? '<span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs">あなた</span>' : ''}
                    </div>
                </div>
            `;
            usersList.appendChild(div);
        });
    });
}

function scrollToBottom() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));
}