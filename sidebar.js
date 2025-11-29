// sidebar.js
import { collection, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
    setupSidebarEvents();
    renderChannelList(onRoomSelect);
    
    // モバイル用メニュー開閉イベント
    menuBtn.addEventListener('click', openSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
}

function setupSidebarEvents() {
    // 必要に応じて追加
}

// チャンネル一覧描画
export function renderChannelList(onRoomSelect) {
    roomListEl.innerHTML = '';
    AVAILABLE_CHANNELS.forEach(room => {
        const btn = document.createElement('button');
        const isActive = room.id === state.currentRoomId;
        btn.className = `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm ${
            isActive ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
        }`;
        btn.innerHTML = `<span class="opacity-50 text-lg leading-none">#</span><span>${room.name}</span>`;
        
        btn.onclick = () => {
            onRoomSelect(room.id, room.name);
            updateHighlights();
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
            btn.dataset.roomId = dmId; // ハイライト用
            const isActive = dmId === state.currentRoomId;
            btn.className = `w-full text-left px-3 py-2 rounded-md mb-1 flex items-center gap-2 transition text-sm ${
                isActive ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`;
            
            btn.innerHTML = `
                <img src="${user.photoURL}" class="w-5 h-5 rounded-full bg-slate-500 opacity-80 object-cover">
                <span class="truncate">${escapeHTML(user.displayName)}</span>
            `;
            
            btn.onclick = () => {
                onRoomSelect(dmId, user.displayName);
                updateHighlights();
            };
            dmListEl.appendChild(btn);
        });
    });
}

// 選択状態（ハイライト）の更新
export function updateHighlights() {
    renderChannelList((id, name) => { /* 再描画時のコールバックは既に登録済みなので空でOKだが再帰に注意 */ }); 
    // ※renderChannelListを呼ぶと全再描画になるため、ここでは簡易的にクラスを付け替えるのが効率的ですが
    //  コードを単純にするため再描画アプローチをとっています。
    //  ただしrenderChannelListの引数が必要になるため、今回は簡易実装として
    //  「DOMのクラスを直接書き換える」方式を推奨します。
    
    // チャンネルリストのハイライト更新
    Array.from(roomListEl.children).forEach(btn => {
        // ボタンのHTMLテキストから判定するのは不安定なので、本当はIDを持たせた方が良い
        // 今回は再描画で対応します（main.jsから制御）
    });
    
    closeSidebar();
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