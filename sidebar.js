// sidebar.js
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, AVAILABLE_CHANNELS } from "./config.js";
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

// サイドバー初期化
export function initSidebar(onRoomSelect) {
    renderChannelList(onRoomSelect);
    
    // モバイル用メニュー開閉イベント
    if(menuBtn) menuBtn.addEventListener('click', openSidebar);
    if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
}

// チャンネル一覧描画
export function renderChannelList(onRoomSelect) {
    roomListEl.innerHTML = '';
    AVAILABLE_CHANNELS.forEach(room => {
        const btn = document.createElement('button');
        // ★追加: IDをデータ属性として埋め込む（後でハイライト判定に使う）
        btn.dataset.roomId = room.id;
        
        // 初期表示時の判定
        const isActive = room.id === state.currentRoomId;
        btn.className = getButtonClass(isActive);
        
        btn.innerHTML = `<span class="opacity-50 text-lg leading-none">#</span><span>${room.name}</span>`;
        
        btn.onclick = () => {
            onRoomSelect(room.id, room.name);
        };
        roomListEl.appendChild(btn);
    });
}

// ユーザー一覧＆DMリスト読み込み
export function loadUserListToSidebar(onRoomSelect) {
    if(unsubscribeUsers) unsubscribeUsers();
    
    const q = query(collection(db, "users"), orderBy("lastLogin", "desc"));
    
    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        resetUserCache();
        dmListEl.innerHTML = '';

        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            updateUserCache(docSnap.id, user);

            if (user.uid === state.currentUser.uid) return;

            const uids = [state.currentUser.uid, user.uid].sort();
            const dmId = `${uids[0]}_${uids[1]}`;

            const btn = document.createElement('button');
            // ★追加: IDをデータ属性として埋め込む
            btn.dataset.roomId = dmId;

            // 初期表示時の判定
            const isActive = dmId === state.currentRoomId;
            btn.className = getButtonClass(isActive);
            
            btn.innerHTML = `
                <img src="${user.photoURL}" class="w-5 h-5 rounded-full bg-slate-500 opacity-80 object-cover">
                <span class="truncate">${escapeHTML(user.displayName)}</span>
            `;
            
            btn.onclick = () => {
                onRoomSelect(dmId, user.displayName);
            };
            dmListEl.appendChild(btn);
        });
    });
}

// ★追加: ハイライトを一括更新する関数
export function updateSidebarHighlights() {
    // チャンネルリストの更新
    Array.from(roomListEl.children).forEach(btn => {
        const isActive = btn.dataset.roomId === state.currentRoomId;
        btn.className = getButtonClass(isActive);
    });

    // DMリストの更新
    Array.from(dmListEl.children).forEach(btn => {
        const isActive = btn.dataset.roomId === state.currentRoomId;
        btn.className = getButtonClass(isActive);
    });
    
    // 部屋が変わったらサイドバーを閉じる（モバイル用）
    closeSidebar();
}

// スタイル定義を一箇所にまとめる
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
}