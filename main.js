// main.js
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, provider } from "./config.js";
import { state, setCurrentUser, setCurrentRoomId } from "./store.js";
import { initSidebar, loadUserListToSidebar, updateSidebarHighlights, cleanupSidebar, closeSidebar } from "./sidebar.js";
import { initChat, loadMessages, cleanupChat, closeThread } from "./chat.js";
import { initPresence } from "./presence.js";
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
const changeNameBtn = document.getElementById('change-name-btn');
const changeNameModal = document.getElementById('change-name-modal');
const changeNameInput = document.getElementById('change-name-input');
const changeNameSaveBtn = document.getElementById('change-name-save-btn');
const changeNameCancelBtn = document.getElementById('change-name-cancel-btn');

// 初期化
initSidebar(handleRoomSelect);
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
        
        initPresence(user);
        
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
        
        loadUserListToSidebar(handleRoomSelect);
        handleRoomSelect('general', 'General');
        
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
    if (state.currentRoomId === roomId && msgContainer.hasChildNodes()) {
        updateSidebarHighlights();
        return; 
    }
    
    setCurrentRoomId(roomId);
    
    const isDm = roomId.includes('_');
    currentRoomNameEl.innerHTML = isDm 
        ? `<span class="text-slate-400 text-sm font-normal mr-1">DM:</span> ${escapeHTML(roomName)}`
        : `<span class="text-slate-400">#</span> ${roomName}`;

    updateSidebarHighlights();
    loadMessages(roomId, roomName);
}

// --- メンバー一覧モーダル (DM開始用) ---
usersBtn.addEventListener('click', () => {
    usersModal.classList.remove('hidden');
    usersModal.classList.add('flex');
    renderUserListModal();
});

function renderUserListModal() {
    console.log("🔵 [main.js] renderUserListModal userCache =", JSON.stringify(state.userCache, null, 2));
    usersList.innerHTML = '';
    
    Object.values(state.userCache).forEach(user => {
        const isMe = user.uid === state.currentUser?.uid;

        const displayNameForList =
            user.displayNameAlias || user.displayName || '(no name)';

        const div = document.createElement('div');
        div.className = "flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition cursor-pointer";
        div.innerHTML = `
            <img src="${user.photoURL}" class="w-8 h-8 rounded-md bg-slate-200 object-cover">
            <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <span class="truncate">${escapeHTML(displayNameForList)}</span>
                    ${isMe ? '<span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs">あなた</span>' : ''}
                </div>
            </div>
            ${!isMe ? '<svg ... 略 ... </svg>' : ''}
        `;
        if(!isMe) {
            div.onclick = () => {
                const uids = [state.currentUser.uid, user.uid].sort();
                const dmId = `${uids[0]}_${uids[1]}`;
                usersModal.classList.add('hidden');
                usersModal.classList.remove('flex');
                handleRoomSelect(dmId, displayNameForList);
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

changeNameBtn.addEventListener('click', () => {
    const uid = state.currentUser.uid;
    const me = state.userCache[uid];

    changeNameInput.value =
        me.displayNameAlias ||
        me.displayName ||
        state.currentUser.displayName;

    changeNameModal.classList.remove('hidden');
    changeNameModal.classList.add('flex');
});

changeNameCancelBtn.addEventListener('click', () => {
    changeNameModal.classList.add('hidden');
});

changeNameSaveBtn.addEventListener('click', async () => {
    const newName = changeNameInput.value.trim();
    if (!newName) return;

    const uid = state.currentUser.uid;

    await setDoc(
        doc(db, "users", uid),
        { displayNameAlias: newName },
        { merge: true }
    );

    if (state.userCache[uid]) {
        state.userCache[uid].displayNameAlias = newName;
    }

    console.log("✅ [main.js] after alias save userCache =", JSON.stringify(state.userCache[uid], null, 2));

    loadUserListToSidebar(handleRoomSelect);

    changeNameModal.classList.add('hidden');
    changeNameModal.classList.remove('flex');
});

