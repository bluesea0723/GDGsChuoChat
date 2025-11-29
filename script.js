// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, increment, where } 
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

const AVAILABLE_CHANNELS = [
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

// Sidebar
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const roomListEl = document.getElementById('room-list');
const dmListEl = document.getElementById('dm-list');
const currentRoomNameEl = document.getElementById('current-room-name');

// Thread
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
let userCache = {}; 

let unsubscribeMsg = null;
let unsubscribeUsers = null; // サイドバーとモーダル兼用
let unsubscribeThread = null;

// --- 初期化 ---
renderChannelList();

// --- ログイン処理 ---
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed", error);
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- 認証監視 ---
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
        } catch (e) { console.error(e); }

        loginScreen.style.opacity = '0';
        setTimeout(() => loginScreen.style.display = 'none', 500);
        
        loadUserListToSidebar(); // ★変更: 全ユーザーをサイドバーに読み込む
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
function renderChannelList() {
    roomListEl.innerHTML = '';
    AVAILABLE_CHANNELS.forEach(room => {
        const btn = document.createElement('button');
        const isActive = room.id === currentRoomId;
        btn.className = `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm ${
            isActive ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
        }`;
        btn.innerHTML = `<span class="opacity-50 text-lg leading-none">#</span><span>${room.name}</span>`;
        btn.onclick = () => switchRoom(room.id, room.name);
        roomListEl.appendChild(btn);
    });
}

// ★変更: 全ユーザーをサイドバーのDM欄に表示する関数
function loadUserListToSidebar() {
    if(unsubscribeUsers) unsubscribeUsers();
    
    // 最終ログイン順に全ユーザーを取得
    const q = query(collection(db, "users"), orderBy("lastLogin", "desc"));
    
    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        userCache = {}; // キャッシュ更新
        dmListEl.innerHTML = ''; // リストクリア

        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            userCache[docSnap.id] = user;

            // 自分自身はリストに表示しない
            if (user.uid === currentUser.uid) return;

            // DMのIDを計算（すでにDMがあろうがなかろうが、IDのルールは同じ）
            const uids = [currentUser.uid, user.uid].sort();
            const dmId = `${uids[0]}_${uids[1]}`;

            const btn = document.createElement('button');
            const isActive = dmId === currentRoomId;
            btn.className = `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm ${
                isActive ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`;
            
            btn.innerHTML = `
                <img src="${user.photoURL}" class="w-5 h-5 rounded-full bg-slate-500 opacity-80 object-cover">
                <span class="truncate">${escapeHTML(user.displayName)}</span>
            `;
            
            // クリックしたらDM開始（または移動）
            btn.onclick = () => startDM(user);
            dmListEl.appendChild(btn);
        });
    });
}

function switchRoom(roomId, roomName) {
    if (currentRoomId === roomId) return;
    currentRoomId = roomId;
    
    const isDm = roomId.includes('_');
    currentRoomNameEl.innerHTML = isDm 
        ? `<span class="text-slate-400 text-sm font-normal mr-1">DM:</span> ${escapeHTML(roomName)}`
        : `<span class="text-slate-400">#</span> ${roomName}`;

    renderChannelList();
    // サイドバーのDMリストのハイライトも更新するために再描画したいが、
    // onSnapshotがリアルタイムで動いているので、簡易的にここでのDOM操作は省略し、
    // ユーザーリストの更新（再読み込み）を待つか、クリック時のクラス切り替えに任せます。
    // ※確実にハイライトを変えるなら loadUserListToSidebar 内で判定していますが、
    //   Firestoreの更新がないと再実行されないため、ここでは簡易実装とします。
    
    // 手動でハイライト切り替え（見た目の即時反映）
    const allButtons = dmListEl.querySelectorAll('button');
    allButtons.forEach(btn => {
        // ボタンのテキストと部屋名が一致するか簡易チェック
        if(btn.innerText.includes(roomName)) {
             btn.className = `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm bg-slate-700 text-white font-bold`;
        } else {
             btn.className = `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm text-slate-400 hover:bg-slate-700/50 hover:text-slate-200`;
        }
    });

    closeSidebar();
    closeThread();
    loadMessages(roomId);
}

// --- DM開始ロジック ---
async function startDM(targetUser) {
    if (targetUser.uid === currentUser.uid) return;

    const uids = [currentUser.uid, targetUser.uid].sort();
    const dmId = `${uids[0]}_${uids[1]}`;
    
    try {
        // DMドキュメントを作成（存在しなければ）
        await setDoc(doc(db, "dms", dmId), {
            participants: uids,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        // モーダルが開いていれば閉じる
        usersModal.classList.add('hidden');
        usersModal.classList.remove('flex');
        
        switchRoom(dmId, targetUser.displayName);
    } catch (e) {
        console.error("Error creating DM:", e);
        alert("DMを開始できませんでした");
    }
}


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
    sendBtn.disabled = this.value.trim() === '';
    sendBtn.classList.toggle('opacity-50', this.value.trim() === '');
});

async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || !currentUser) return;
    sendBtn.disabled = true;

    const isDm = currentRoomId.includes('_');
    const collectionPath = isDm ? `dms/${currentRoomId}/messages` : `rooms/${currentRoomId}/messages`;

    try {
        await addDoc(collection(db, collectionPath), {
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

// --- メッセージ読み込み & 表示 ---
function loadMessages(roomId) {
    if (unsubscribeMsg) { unsubscribeMsg(); unsubscribeMsg = null; }
    msgContainer.innerHTML = '';
    
    const isDm = roomId.includes('_');
    const collectionPath = isDm ? `dms/${roomId}/messages` : `rooms/${roomId}/messages`;
    
    const q = query(collection(db, collectionPath), orderBy("createdAt", "asc"));
    
    unsubscribeMsg = onSnapshot(q, (snapshot) => {
        msgContainer.innerHTML = '';
        let lastUid = null;
        let lastDateString = null;
        
        if (snapshot.empty) {
            msgContainer.innerHTML = `<div class="text-center text-slate-400 text-sm mt-10">メッセージはまだありません</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const msgId = docSnap.id;
            const currentDateString = formatDateLabel(data.createdAt);
            const replyCount = data.replyCount || 0;
            const isMe = data.uid === currentUser.uid;

            if (currentDateString !== lastDateString) {
                const dateDivider = document.createElement('div');
                dateDivider.className = "relative flex items-center justify-center my-6";
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

            if (isDm) {
                // LINE風 (DM)
                msgRow.className = `flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isContinuous ? 'mt-1' : 'mt-4'} fade-in`;
                
                if (isMe) {
                    msgRow.innerHTML = `
                        <div class="max-w-[75%] flex flex-col items-end">
                            <div class="flex items-end gap-1">
                                <span class="text-[10px] text-slate-400 mb-1">${timeString}</span>
                                <div class="bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm text-sm leading-relaxed break-words shadow-sm">
                                    ${escapeHTML(data.text).replace(/\n/g, '<br>')}
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    msgRow.innerHTML = `
                        <div class="flex items-start gap-2 max-w-[85%]">
                            ${!isContinuous ? `<img src="${data.photoURL}" class="w-8 h-8 rounded-full bg-slate-200 object-cover mt-1">` : '<div class="w-8"></div>'}
                            <div>
                                ${!isContinuous ? `<div class="text-[10px] text-slate-500 ml-1 mb-1">${escapeHTML(data.displayName)}</div>` : ''}
                                <div class="flex items-end gap-1">
                                    <div class="bg-white text-slate-800 border border-slate-200 px-4 py-2 rounded-2xl rounded-tl-sm text-sm leading-relaxed break-words shadow-sm">
                                        ${escapeHTML(data.text).replace(/\n/g, '<br>')}
                                    </div>
                                    <span class="text-[10px] text-slate-400 mb-1">${timeString}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } else {
                // Slack風 (Channel)
                msgRow.className = `flex gap-3 px-2 py-1 hover:bg-slate-100 transition rounded-lg group ${isContinuous ? 'mt-0' : 'mt-1'}`;
                
                const replyIndicator = replyCount > 0 ? `
                    <div class="mt-1 flex items-center gap-2 cursor-pointer group/reply" onclick="event.stopPropagation();">
                        <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 hover:bg-white hover:border hover:border-slate-200 hover:shadow-sm border border-transparent transition thread-link">
                            <img src="${data.photoURL}" class="w-4 h-4 rounded-sm opacity-70">
                            <span class="text-xs font-bold text-blue-600">${replyCount}件の返信</span>
                            <span class="text-[10px] text-slate-400">を確認する</span>
                        </div>
                    </div>
                ` : '';

                const openThreadAction = () => openThread(msgId, data);

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
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                            </button>
                        </div>
                    `;
                } else {
                    msgRow.innerHTML = `
                        <div class="w-9 shrink-0 text-[10px] text-slate-300 text-right opacity-0 group-hover:opacity-100 select-none pt-1.5 pr-1">${timeString}</div>
                        <div class="flex-1 min-w-0">
                            <div class="text-slate-800 text-[15px] leading-relaxed break-words whitespace-pre-wrap">${escapeHTML(data.text)}</div>
                            ${replyIndicator}
                        </div>
                        <div class="opacity-0 group-hover:opacity-100 flex items-start pt-0">
                            <button class="text-slate-400 hover:text-blue-500 p-1 rounded hover:bg-slate-200 transition reply-btn" title="スレッドで返信">
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                            </button>
                        </div>
                    `;
                }
                const btn = msgRow.querySelector('.reply-btn');
                if(btn) btn.onclick = openThreadAction;
                const link = msgRow.querySelector('.thread-link');
                if(link) link.onclick = openThreadAction;
            }

            msgContainer.appendChild(msgRow);
            lastUid = data.uid;
        });
        scrollToBottom();
    });
}

// --- ユーティリティ ---
// メンバー一覧モーダル用（サイドバーと同じリストだが一応残す）
usersBtn.addEventListener('click', () => {
    usersModal.classList.remove('hidden');
    usersModal.classList.add('flex');
    renderUserListModal();
});

function renderUserListModal() {
    usersList.innerHTML = '';
    Object.values(userCache).forEach(user => {
        const isMe = user.uid === currentUser.uid;
        const div = document.createElement('div');
        div.className = "flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition cursor-pointer";
        div.innerHTML = `
            <img src="${user.photoURL}" class="w-8 h-8 rounded-md bg-slate-200 object-cover">
            <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span class="truncate">${escapeHTML(user.displayName)}</span>
                    ${isMe ? '<span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs">あなた</span>' : ''}
                </div>
            </div>
            ${!isMe ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.18.063-2.33.12-3.45.164m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.197.397-1.608.209-2.76 1.614-2.76 3.235v1.81A25.11 25.11 0 002.23 13.041l-.63 6.6a1.125 1.125 0 001.29 1.196c.096-.01.192-.023.287-.04l5.63-1.057a49.19 49.19 0 0110.151-.836c.925-.065 1.76-.717 1.942-1.631l1.55-7.75a1.866 1.866 0 00-1.25-2.132z" /></svg>' : ''}
        `;
        if(!isMe) {
            div.onclick = () => startDM(user);
        }
        usersList.appendChild(div);
    });
}

closeUsersBtn.addEventListener('click', () => {
    usersModal.classList.add('hidden');
    usersModal.classList.remove('flex');
});
usersModal.addEventListener('click', (e) => {
    if (e.target === usersModal) closeUsersBtn.click();
});


// --- スレッド機能 ---
function openThread(messageId, parentData) {
    currentThreadParentId = messageId;
    threadSidebar.classList.remove('translate-x-full');
    threadSidebar.classList.add('translate-x-0');
    
    const isChannel = AVAILABLE_CHANNELS.find(r => r.id === currentRoomId);
    threadRoomNameEl.textContent = isChannel ? isChannel.name : 'DM';

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
    if (unsubscribeThread) { unsubscribeThread(); unsubscribeThread = null; }
    currentThreadParentId = null;
}
closeThreadBtn.addEventListener('click', closeThread);

function loadThreadMessages(parentId) {
    if (unsubscribeThread) unsubscribeThread();
    threadMsgContainer.innerHTML = '';
    
    const isDm = currentRoomId.includes('_');
    const collectionPath = isDm ? `dms/${currentRoomId}/messages/${parentId}/thread` : `rooms/${currentRoomId}/messages/${parentId}/thread`;

    const q = query(collection(db, collectionPath), orderBy("createdAt", "asc"));
    
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
        
        const parentPath = isDm ? `dms/${currentRoomId}/messages` : `rooms/${currentRoomId}/messages`;
        updateDoc(doc(db, parentPath, parentId), { replyCount: snapshot.size }).catch(e=>{});
    });
}

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
    const isDm = currentRoomId.includes('_');
    const basePath = isDm ? `dms/${currentRoomId}/messages` : `rooms/${currentRoomId}/messages`;

    try {
        await addDoc(collection(db, `${basePath}/${currentThreadParentId}/thread`), {
            text: text,
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, basePath, currentThreadParentId), { replyCount: increment(1) });
        threadInput.value = '';
    } catch (e) { console.error(e); }
    threadSendBtn.disabled = false;
}

// 共通制御
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
function scrollToBottom() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
}
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));
}