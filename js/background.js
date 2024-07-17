async function getKeyFromPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function decryptData(encrypted, password) {
  const { iv, salt, data } = encrypted;
  const key = await getKeyFromPassword(password, salt);

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv)
    },
    key,
    new Uint8Array(data)
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedData));
}

async function generateAccessToken(creds) {
  const jwtHeader = {
    alg: "RS256",
    typ: "JWT"
  };

  const jwtClaimSet = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
    iat: Math.floor(Date.now() / 1000)
  };

  const base64Encode = (obj) => {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const toBase64 = (str) => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const signatureInput = base64Encode(jwtHeader) + "." + base64Encode(jwtClaimSet);

  const pem = creds.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binaryKey = atob(pem);
  const binaryArray = new Uint8Array(binaryKey.length);

  for (let i = 0; i < binaryKey.length; i++) {
    binaryArray[i] = binaryKey.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryArray.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    true,
    ['sign']
  );

  const signatureArrayBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = toBase64(String.fromCharCode(...new Uint8Array(signatureArrayBuffer)));

  const jwt = signatureInput + "." + signature;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    throw new Error(`HTTP error! status: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAccessToken') {
    chrome.storage.local.get(['accessToken', 'tokenExpiry'], (result) => {
      const currentTime = Math.floor(Date.now() / 1000);
      if (!request.new && result.accessToken && result.tokenExpiry && currentTime < result.tokenExpiry) {
        sendResponse({ accessToken: result.accessToken });
      } else {
        fetch(chrome.runtime.getURL('creds.json'))
          .then(response => response.json())
          .then(encryptedData => decryptData(encryptedData, request.password))
          .then(creds => generateAccessToken(creds))
          .then(accessToken => {
            const tokenExpiry = Math.floor(Date.now() / 1000) + 3000; // 1 hour from now
            chrome.storage.local.set({ accessToken: accessToken, tokenExpiry: tokenExpiry });
            sendResponse({ accessToken });
          })
          .catch(error => {
            sendResponse(null);
          });
      }
    });

    return true; // This keeps the message channel open for the asynchronous response
  }
});

