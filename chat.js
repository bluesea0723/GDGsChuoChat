// chat.js
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./config.js";
import { state } from "./store.js";
import { formatTime, formatDateLabel, escapeHTML, linkify, scrollToBottom } from "./utils.js";

// DOM要素
const msgContainer = document.getElementById('messages-container');
const msgInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// スレッド用エレメント
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

function setupChatEvents() {
    sendBtn.addEventListener('click', () => sendMessage());
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    msgInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        toggleSendBtn();
    });

    threadSendBtn.addEventListener('click', sendThreadMessage);
    threadInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendThreadMessage();
        }
    });
    
    closeThreadBtn.addEventListener('click', closeThread);
}

function toggleSendBtn() {
    const text = msgInput.value.trim();
    sendBtn.disabled = text === '';
    if(text === '') {
        sendBtn.classList.add('opacity-50');
    } else {
        sendBtn.classList.remove('opacity-50');
    }
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
            displayName: state.currentUser.displayName,
            photoURL: state.currentUser.photoURL,
            createdAt: serverTimestamp(),
            replyCount: 0 
        });
        
        msgInput.value = '';
        msgInput.style.height = 'auto';
        msgInput.focus();
    } catch (error) {
        console.error("Error sending message: ", error);
        alert("送信できませんでした。");
    } finally {
        sendBtn.disabled = false;
        toggleSendBtn();
    }
}

// ★追加: メッセージ削除機能
async function deleteMessage(messageId, isThread = false) {
    if(!confirm("このメッセージを削除しますか？")) return;

    const isDm = state.currentRoomId.includes('_');
    let docPath = '';

    if (isThread) {
        // スレッドメッセージの削除
        const basePath = isDm ? `dms/${state.currentRoomId}/messages` : `rooms/${state.currentRoomId}/messages`;
        docPath = `${basePath}/${currentThreadParentId}/thread/${messageId}`;
    } else {
        // メインメッセージの削除
        const basePath = isDm ? `dms/${state.currentRoomId}/messages` : `rooms/${state.currentRoomId}/messages`;
        docPath = `${basePath}/${messageId}`;
    }

    try {
        await deleteDoc(doc(db, docPath));
    } catch (error) {
        console.error("Delete failed:", error);
        alert("削除できませんでした。");
    }
}

// メッセージ読み込み
export function loadMessages(roomId, roomName) {
    if (unsubscribeMsg) { unsubscribeMsg(); unsubscribeMsg = null; }
    msgContainer.innerHTML = '';
    
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

            let contentHtml = '';
            if (data.text) {
                contentHtml += `<div>${linkify(data.text).replace(/\n/g, '<br>')}</div>`;
            }

            // ★追加: 削除ボタンHTML（自分のみ表示）
            const deleteBtnHtml = isMe ? `
                <button class="delete-btn text-slate-300 hover:text-red-500 p-1 transition opacity-0 group-hover:opacity-100" title="削除">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            ` : '';

            if (isDm) {
                // DM (LINE風)
                msgRow.className = `flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isContinuous ? 'mt-1' : 'mt-4'} fade-in group`;
                if (isMe) {
                    msgRow.innerHTML = `
                        <div class="max-w-[75%] flex items-end gap-2">
                            ${deleteBtnHtml}
                            <div class="flex flex-col items-end">
                                <div class="flex items-end gap-1">
                                    <span class="text-[10px] text-slate-400 mb-1">${timeString}</span>
                                    <div class="bg-blue-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm text-sm leading-relaxed break-words shadow-sm">
                                        ${contentHtml}
                                    </div>
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
                                        ${contentHtml}
                                    </div>
                                    <span class="text-[10px] text-slate-400 mb-1">${timeString}</span>
                                </div>
                            </div>
                        </div>`;
                }
            } else {
                // Channel (Slack風)
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

                // アクションボタン（返信＋削除）
                const actionButtons = `
                    <div class="opacity-0 group-hover:opacity-100 flex items-start pt-1 gap-1">
                        <button class="text-slate-400 hover:text-blue-500 p-1 rounded hover:bg-slate-200 transition reply-btn" title="スレッドで返信">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
                        </button>
                        ${deleteBtnHtml}
                    </div>
                `;

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
                            <div class="text-slate-800 text-[15px] leading-relaxed break-words whitespace-pre-wrap mt-0.5">${contentHtml}</div>
                            ${replyIndicator}
                        </div>
                        ${actionButtons}
                    `;
                } else {
                    msgRow.innerHTML = `
                        <div class="w-9 shrink-0 text-[10px] text-slate-300 text-right opacity-0 group-hover:opacity-100 select-none pt-1.5 pr-1">${timeString}</div>
                        <div class="flex-1 min-w-0">
                            <div class="text-slate-800 text-[15px] leading-relaxed break-words whitespace-pre-wrap">${contentHtml}</div>
                            ${replyIndicator}
                        </div>
                        ${actionButtons}
                    `;
                }

                const btn = msgRow.querySelector('.reply-btn');
                if(btn) btn.onclick = openThreadAction;
                const link = msgRow.querySelector('.thread-link');
                if(link) link.onclick = openThreadAction;
            }

            // 削除ボタンイベント
            const delBtn = msgRow.querySelector('.delete-btn');
            if(delBtn) delBtn.onclick = () => deleteMessage(msgId, false);

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

    let contentHtml = '';
    if (parentData.text) {
        contentHtml += `<div>${linkify(parentData.text)}</div>`;
    }

    threadParentMsgEl.innerHTML = `
        <div class="flex gap-3">
            <img src="${parentData.photoURL}" class="w-8 h-8 rounded-md bg-slate-200 object-cover mt-1">
            <div>
                <div class="flex items-baseline gap-2">
                    <span class="font-bold text-slate-700 text-sm">${escapeHTML(parentData.displayName)}</span>
                    <span class="text-[10px] text-slate-400">${formatTime(parentData.createdAt)}</span>
                </div>
                <div class="text-slate-800 text-sm mt-1">${contentHtml}</div>
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
            const msgId = docSnap.id;
            const isMe = data.uid === state.currentUser.uid;

            // ★追加: スレッド内の削除ボタン
            const deleteBtnHtml = isMe ? `
                <button class="delete-btn text-slate-300 hover:text-red-500 p-1 ml-auto opacity-0 group-hover:opacity-100 transition" title="削除">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            ` : '';

            const div = document.createElement('div');
            div.className = "flex gap-2 mb-3 group";
            div.innerHTML = `
                <img src="${data.photoURL}" class="w-7 h-7 rounded-md bg-slate-200 object-cover mt-1">
                <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                        <span class="font-bold text-slate-700 text-xs">${escapeHTML(data.displayName)}</span>
                        <span class="text-[10px] text-slate-400">${formatTime(data.createdAt)}</span>
                        ${deleteBtnHtml}
                    </div>
                    <div class="text-slate-800 text-sm mt-0.5 break-words whitespace-pre-wrap">${linkify(data.text)}</div>
                </div>
            `;
            
            const delBtn = div.querySelector('.delete-btn');
            if(delBtn) delBtn.onclick = () => deleteMessage(msgId, true);

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
            displayName: state.currentUser.displayName,
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