chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getAccessToken") {
    fetch("https://10c22397-7ff8-474d-a2c8-c12ff48fecfc-00-15alyngotgdox.asia-b.replit.dev/get_access_token", {
      method: "GET",
      headers: {
        "api-key": "TltdtJXQKwMmRY4SlvOTLO1TXHGkOBwP",
        'App-Identifier': 'Klero-extention'
    },
    })
    .then((response) => {
      if (response.status === 200) {
        return response.json();
      }
      throw new Error(`Request failed with status: ${response.status}`);
    })
    .then((data) => {
      sendResponse(data["access_token"]);
    })
    .catch(() => {
      sendResponse(null);
    });
    return true; // This keeps the message channel open for the asynchronous response
  }
});
