// Simplified E2EE utility for demonstration
// In a production app, use SubtleCrypto or a library like crypto-js
const SECRET_KEY = 'chat-key-123'; 

export const encryptMessage = (text) => {
    // Mock encryption: Base64 + simple shift or XOR
    return btoa(text.split('').map(c => String.fromCharCode(c.charCodeAt(0) + 1)).join(''));
};

export const decryptMessage = (encoded) => {
    try {
        const shifted = atob(encoded);
        return shifted.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 1)).join('');
    } catch (e) {
        return encoded; // Fallback to raw if not encrypted correctly
    }
};
