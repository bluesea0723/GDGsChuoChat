// sidebar.js
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// ★追加: Realtime Database関連のインポート
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
let unsubscribeStatus = null; // ★追加: ステータス監視用
let userStatusMap = {};       // ★追加: UID -> 'online' | 'offline'

// サイドバー初期化
export function initSidebar(onRoomSelect) {
    renderChannelList(onRoomSelect);
    
    // ★追加: 全ユーザーのオンライン状態をリアルタイム監視開始
    startStatusListener();

    if(menuBtn) menuBtn.addEventListener('click', openSidebar);
    if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if(sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
}

// チャンネル一覧描画（変更なし）
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

// ★追加: Realtime Databaseのステータスを監視する関数
function startStatusListener() {
    const allStatusRef = ref(rtdb, '/status');
    unsubscribeStatus = onValue(allStatusRef, (snapshot) => {
        userStatusMap = snapshot.val() || {};
        // ステータスが変わったら表示（緑の丸）を更新
        updateOnlineIndicators();
    });
}

// ★追加: 画面上のオンライン表示を更新する関数
function updateOnlineIndicators() {
    // サイドバーのDMリスト内のボタンを走査
    Array.from(dmListEl.children).forEach(btn => {
        const uid = btn.dataset.uid;
        if (!uid) return;

        // ステータスを取得 (online かどうか)
        const userStatus = userStatusMap[uid];
        const isOnline = userStatus && userStatus.state === 'online';

        // 既存のインジケータがあれば削除
        const existingDot = btn.querySelector('.online-dot');
        if (existingDot) existingDot.remove();

        // オンラインなら緑の丸を追加
        if (isOnline) {
            // アイコン画像(img)の親要素に対して配置調整するか、単純に append する
            // ここでは absolute でアイコンの右下に配置するスタイルを追加
            const dot = document.createElement('div');
            dot.className = "online-dot absolute left-7 bottom-2 w-2.5 h-2.5 bg-green-500 border-2 border-slate-800 rounded-full";
            // ボタン自体を relative にしておく必要がある
            btn.classList.add('relative'); 
            btn.appendChild(dot);
        }
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
        
        // リスト描画直後にもステータスを反映
        updateOnlineIndicators();
    });
}

export function updateSidebarHighlights() {
    Array.from(roomListEl.children).forEach(btn => {
        const isActive = btn.dataset.roomId === state.currentRoomId;
        btn.className = getButtonClass(isActive);
    });

    Array.from(dmListEl.children).forEach(btn => {
        const isActive = btn.dataset.roomId === state.currentRoomId;
        btn.className = getButtonClass(isActive);
    });
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
    // ステータス監視も解除したければここで行う（通常はつけっぱなしでOK）
}