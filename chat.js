// chat.js
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./config.js";
import { state } from "./store.js";
import { formatTime, formatDateLabel, escapeHTML, scrollToBottom } from "./utils.js";

// DOM要素
const msgContainer = document.getElementById('messages-container');
const msgInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const threadSidebar = document.getElementById('thread-sidebar');
const closeThreadBtn = document.getElementById('close-thread-btn');
const threadParentMsgEl = document.getElementById('thread-parent-msg');
const threadMsgContainer = document.getElementById('thread-messages-container');
const threadInput = document.getElementById('thread-input');
const threadSendBtn = document.getElementById('thread-send-btn');
const threadRoomNameEl = document.getElementById('thread-room-name');

let unsubscribeMsg = null;
let unsubscribeThread = null;
let currentThreadParentId = null;

// チャット初期化
export function initChat() {
    setupChatEvents();
}

function getMyDisplayNameForChat() {
    const uid = state.currentUser?.uid;
    if (!uid) return "";

    const me = state.userCache[uid];

    return (
        (me && me.displayNameAlias) ||   // alias があれば最優先
        (me && me.displayName) ||        // なければ Firestore の displayName
        state.currentUser.displayName   // 最後の保険（Auth）
    );
}

function setupChatEvents() {
    // メイン送信
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

    // スレッド送信
    threadSendBtn.addEventListener('click', sendThreadMessage);
    threadInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendThreadMessage();
        }
    });
    
    closeThreadBtn.addEventListener('click', closeThread);
}

// メッセージ送信
export async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || !state.currentUser) return;
    sendBtn.disabled = true;

    const isDm = state.currentRoomId.includes('_');
    const collectionPath = isDm ? `dms/${state.currentRoomId}/messages` : `rooms/${state.currentRoomId}/messages`;

    try {
        await addDoc(collection(db, collectionPath), {
            text: text,
            uid: state.currentUser.uid,
            displayName: getMyDisplayNameForChat(),
            photoURL: state.currentUser.photoURL,
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

// メッセージ読み込み
export function loadMessages(roomId, roomName) {
    if (unsubscribeMsg) { unsubscribeMsg(); unsubscribeMsg = null; }
    msgContainer.innerHTML = '';
    
    // 部屋変更時にスレッドは閉じる
    closeThread();
    
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
            const isMe = data.uid === state.currentUser.uid;

            // 日付区切り
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
                // DM (LINE風)
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
                        </div>`;
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
                        </div>`;
                }
            } else {
                // Channel
                msgRow.className = `flex gap-3 px-2 py-1 hover:bg-slate-100 transition rounded-lg group ${isContinuous ? 'mt-0' : 'mt-1'}`;
                const replyIndicator = replyCount > 0 ? `
                    <div class="mt-1 flex items-center gap-2 cursor-pointer group/reply" onclick="event.stopPropagation();">
                        <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 hover:bg-white hover:border hover:border-slate-200 hover:shadow-sm border border-transparent transition thread-link">
                            <img src="${data.photoURL}" class="w-4 h-4 rounded-sm opacity-70">
                            <span class="text-xs font-bold text-blue-600">${replyCount}件の返信</span>
                            <span class="text-[10px] text-slate-400">を確認する</span>
                        </div>
                    </div>` : '';
                
                const openThreadAction = () => openThread(msgId, data, roomName);

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
                        </div>`;
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
                        </div>`;
                }

                const btn = msgRow.querySelector('.reply-btn');
                if(btn) btn.onclick = openThreadAction;
                const link = msgRow.querySelector('.thread-link');
                if(link) link.onclick = openThreadAction;
            }

            msgContainer.appendChild(msgRow);
            lastUid = data.uid;
        });
        scrollToBottom(msgContainer);
    });
}

// スレッド機能
function openThread(messageId, parentData, roomName) {
    currentThreadParentId = messageId;
    threadSidebar.classList.remove('translate-x-full');
    threadSidebar.classList.add('translate-x-0');
    threadRoomNameEl.textContent = roomName;

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

export function closeThread() {
    threadSidebar.classList.add('translate-x-full');
    threadSidebar.classList.remove('translate-x-0');
    if (unsubscribeThread) { unsubscribeThread(); unsubscribeThread = null; }
    currentThreadParentId = null;
}

function loadThreadMessages(parentId) {
    if (unsubscribeThread) unsubscribeThread();
    threadMsgContainer.innerHTML = '';
    
    const isDm = state.currentRoomId.includes('_');
    const collectionPath = isDm ? `dms/${state.currentRoomId}/messages/${parentId}/thread` : `rooms/${state.currentRoomId}/messages/${parentId}/thread`;

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
        scrollToBottom(threadMsgContainer);
        
        const parentPath = isDm ? `dms/${state.currentRoomId}/messages` : `rooms/${state.currentRoomId}/messages`;
        updateDoc(doc(db, parentPath, parentId), { replyCount: snapshot.size }).catch(e=>{});
    });
}

async function sendThreadMessage() {
    const text = threadInput.value.trim();
    if (!text || !state.currentUser || !currentThreadParentId) return;

    threadSendBtn.disabled = true;
    const isDm = state.currentRoomId.includes('_');
    const basePath = isDm ? `dms/${state.currentRoomId}/messages` : `rooms/${state.currentRoomId}/messages`;

    try {
        await addDoc(collection(db, `${basePath}/${currentThreadParentId}/thread`), {
            text: text,
            uid: state.currentUser.uid,
            displayName: getMyDisplayNameForChat(),
            photoURL: state.currentUser.photoURL,
            createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, basePath, currentThreadParentId), { replyCount: increment(1) });
        threadInput.value = '';
    } catch (e) { console.error(e); }
    threadSendBtn.disabled = false;
}

export function cleanupChat() {
    if(unsubscribeMsg) unsubscribeMsg();
    if(unsubscribeThread) unsubscribeThread();
}