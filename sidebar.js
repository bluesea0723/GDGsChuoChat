// sidebar.js
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db, rtdb, AVAILABLE_CHANNELS } from "./config.js";
import { state, updateUserCache, resetUserCache } from "./store.js";
import { escapeHTML } from "./utils.js";

// DOM要素
const roomListEl = document.getElementById('room-list');
const dmListEl = document.getElementById('dm-list');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuBtn = document.getElementById('menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');

let unsubscribeUsers = null;
let unsubscribeStatus = null;
let userStatusMap = {};

// サイドバー初期化
export function initSidebar(onRoomSelect) {
    renderChannelList(onRoomSelect);
    
    // 全ユーザーのオンライン状態をリアルタイム監視開始
    startStatusListener();

    if(menuBtn) menuBtn.addEventListener('click', openSidebar);
    if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
}

// チャンネル一覧描画
export function renderChannelList(onRoomSelect) {
    roomListEl.innerHTML = '';
    AVAILABLE_CHANNELS.forEach(room => {
        const btn = document.createElement('button');
        btn.dataset.roomId = room.id;
        const isActive = room.id === state.currentRoomId;
        btn.className = getButtonClass(isActive);
        btn.innerHTML = `<span class="opacity-50 text-lg leading-none">#</span><span>${room.name}</span>`;
        btn.onclick = () => onRoomSelect(room.id, room.name);
        roomListEl.appendChild(btn);
    });
}

// ステータス監視
function startStatusListener() {
    const allStatusRef = ref(rtdb, '/status');
    unsubscribeStatus = onValue(allStatusRef, (snapshot) => {
        userStatusMap = snapshot.val() || {};
        updateOnlineIndicators();
    });
}

// オンライン表示の更新ロジック
function updateOnlineIndicators() {
    Array.from(dmListEl.children).forEach(btn => {
        const uid = btn.dataset.uid;
        if (!uid) return;

        // ステータス判定
        const userStatus = userStatusMap[uid];
        const isOnline = userStatus && userStatus.state === 'online';

        // 既存の丸があれば削除
        const existingDot = btn.querySelector('.online-dot');
        if (existingDot) existingDot.remove();

        // 新しい丸を作成
        const dot = document.createElement('div');
        // 基本スタイル（共通）
        let dotClass = "online-dot absolute left-7 bottom-2 w-2.5 h-2.5 border-2 border-slate-800 rounded-full ";
        
        if (isOnline) {
            // オンライン: 緑
            dotClass += "bg-green-500";
        } else {
            // オフライン: 灰色
            dotClass += "bg-slate-500";
        }
        
        dot.className = dotClass;
        
        // ★重要: relativeクラスがないと丸の位置がおかしくなるため追加
        btn.classList.add('relative'); 
        btn.appendChild(dot);
    });
}

// ユーザー一覧読み込み
export function loadUserListToSidebar(onRoomSelect) {
    if(unsubscribeUsers) unsubscribeUsers();
    
    const q = query(collection(db, "users"), orderBy("lastLogin", "desc"));
    
    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        resetUserCache();
        dmListEl.innerHTML = '';

        console.log("🟡 [sidebar.js] Firestore users snapshot start");

        snapshot.forEach(docSnap => {
            const user = docSnap.data();

            console.log("🟡 [sidebar.js] Firestore user =", docSnap.id, user);
            updateUserCache(docSnap.id, user);

            // if (user.uid === state.currentUser.uid) return;

            const uids = [state.currentUser.uid, user.uid].sort();
            const dmId = `${uids[0]}_${uids[1]}`;

            const btn = document.createElement('button');
            btn.dataset.roomId = dmId;
            btn.dataset.uid = user.uid;

            const isActive = dmId === state.currentRoomId;
            btn.className = getButtonClass(isActive);

            const displayNameForList =
                user.displayNameAlias || user.displayName || '(no name)';

            btn.innerHTML = `
                <img src="${user.photoURL}" class="w-5 h-5 rounded-full bg-slate-500 opacity-80 object-cover">
                <span class="truncate">${escapeHTML(displayNameForList)}</span>
            `;
            
            btn.onclick = () => onRoomSelect(dmId, displayNameForList);

            dmListEl.appendChild(btn);
        });
        
        updateOnlineIndicators();
    });
}

// ★修正: ハイライト更新時にオンライン表示も再適用する
export function updateSidebarHighlights() {
    Array.from(roomListEl.children).forEach(btn => {
        const isActive = btn.dataset.roomId === state.currentRoomId;
        btn.className = getButtonClass(isActive);
    });

    Array.from(dmListEl.children).forEach(btn => {
        const isActive = btn.dataset.roomId === state.currentRoomId;
        btn.className = getButtonClass(isActive);
    });
    
    // ★追加: クラスを上書きした後に、再度オンライン表示（丸ポチ）をつける
    updateOnlineIndicators();

    closeSidebar();
}

function getButtonClass(isActive) {
    return `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm ${
        isActive ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
    }`;
}

export function closeSidebar() {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    sidebarOverlay.classList.add('hidden');
}

function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    sidebarOverlay.classList.remove('hidden');
}

export function cleanupSidebar() {
    if(unsubscribeUsers) unsubscribeUsers();
    if(unsubscribeStatus) unsubscribeStatus();
}