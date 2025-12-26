/**
 * Global polyfills for the React Native environment.
 * These are imported as early as possible in the app lifecycle.
 */

// Polyfill atob for Hermes environment
if (typeof atob === 'undefined') {
    // @ts-ignore
    global.atob = (str: string) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let output = '';

        // Handle Base64URL (standard for JWT)
        str = String(str)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        // Add padding if missing
        while (str.length % 4 !== 0) {
            str += '=';
        }

        str = str.replace(/=+$/, '');

        if (str.length % 4 === 1) {
            throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
        }

        let bs: number = 0;
        for (
            let bc = 0, buffer, idx = 0;
            (buffer = str.charAt(idx++));
            ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
                ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
                : 0
        ) {
            buffer = chars.indexOf(buffer);
        }
        return output;
    };
}

// Ensure btoa is also available if needed
if (typeof btoa === 'undefined') {
    // @ts-ignore
    global.btoa = (str: string) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let output = '';
        for (
            let block = 0, charCode, idx = 0, map = chars;
            str.charAt(idx | 0) || ((map = '='), idx % 1);
            output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))
        ) {
            charCode = str.charCodeAt((idx += 3 / 4));
            if (charCode > 0xff) {
                throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
            }
            block = (block << 8) | charCode;
        }
        return output;
    };
}
