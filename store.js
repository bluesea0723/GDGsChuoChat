// store.js
export const state = {
    currentUser: null,
    currentRoomId: 'general',
    userCache: {} // UID -> UserData
};

export function setCurrentUser(user) {
    state.currentUser = user;
}

export function setCurrentRoomId(roomId) {
    state.currentRoomId = roomId;
}

export function updateUserCache(id, data) {
    state.userCache[id] = data;
}

export function resetUserCache() {
    state.userCache = {};
}