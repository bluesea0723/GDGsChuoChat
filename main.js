// main.js
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, getDoc, setDoc as setDocFs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, provider } from "./config.js";
import { state, setCurrentUser, setCurrentRoomId } from "./store.js";
import { initSidebar, loadUserListToSidebar, renderChannelList, cleanupSidebar, closeSidebar } from "./sidebar.js";
import { initChat, loadMessages, cleanupChat, closeThread } from "./chat.js";
import { escapeHTML } from "./utils.js";

// DOM要素
const loginScreen = document.getElementById('login-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const usersBtn = document.getElementById('users-btn');
const usersModal = document.getElementById('users-modal');
const closeUsersBtn = document.getElementById('close-users-btn');
const usersList = document.getElementById('users-list');
const currentRoomNameEl = document.getElementById('current-room-name');
const msgContainer = document.getElementById('messages-container');

// 初期化
initSidebar(handleRoomSelect); // サイドバーに「部屋が選ばれたら何をするか」を渡す
initChat();

// --- 認証ロジック ---
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        setCurrentUser(user);
        
        // ユーザー情報保存
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
        
        // データ読み込み開始
        loadUserListToSidebar(handleRoomSelect);
        handleRoomSelect('general', 'General'); // 初期表示
        
        // モーダルのユーザーリスト用イベント（サイドバーとは別だが、ロジックは似ているので簡易実装）
        // ※実際にはsidebar.jsのロジックを再利用するか、storeのcacheを使うと良い
        renderUserListModal(); 

    } else {
        setCurrentUser(null);
        loginScreen.style.display = 'flex';
        setTimeout(() => loginScreen.style.opacity = '1', 50);
        
        cleanupSidebar();
        cleanupChat();
        msgContainer.innerHTML = '';
        closeSidebar();
        closeThread();
    }
});

// --- 部屋切り替えロジック ---
function handleRoomSelect(roomId, roomName) {
    if (state.currentRoomId === roomId && msgContainer.hasChildNodes()) return; // 同じ部屋ならリロードしない
    
    setCurrentRoomId(roomId);
    
    // ヘッダー更新
    const isDm = roomId.includes('_');
    currentRoomNameEl.innerHTML = isDm 
        ? `<span class="text-slate-400 text-sm font-normal mr-1">DM:</span> ${escapeHTML(roomName)}`
        : `<span class="text-slate-400">#</span> ${roomName}`;

    // サイドバーの表示更新（ハイライトなど）
    renderChannelList(handleRoomSelect); // 再描画でハイライト適用
    
    // チャット読み込み
    loadMessages(roomId, roomName);
}

// --- メンバー一覧モーダル (DM開始用) ---
usersBtn.addEventListener('click', () => {
    usersModal.classList.remove('hidden');
    usersModal.classList.add('flex');
    renderUserListModal();
});

function renderUserListModal() {
    usersList.innerHTML = '';
    // store.jsのuserCacheを使ってもいいが、ここではシンプルに再取得せずcacheがある前提で動くか、
    // sidebar.jsからimportしたデータを使うのが綺麗。
    // 今回は簡易的にstore.state.userCacheを使います。
    
    Object.values(state.userCache).forEach(user => {
        const isMe = user.uid === state.currentUser?.uid;
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
            div.onclick = () => {
                // DM開始処理
                const uids = [state.currentUser.uid, user.uid].sort();
                const dmId = `${uids[0]}_${uids[1]}`;
                // DM作成 (Sidebarのロジックと同じだが、importが循環するのでここで作成)
                setDocFs(doc(db, "dms", dmId), { participants: uids, updatedAt: serverTimestamp() }, { merge: true })
                    .then(() => {
                        usersModal.classList.add('hidden');
                        usersModal.classList.remove('flex');
                        handleRoomSelect(dmId, user.displayName);
                    });
            };
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