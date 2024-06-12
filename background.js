chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getAccessToken") {
    fetch("https://kleroapi.onrender.com/access-token", {
      method: "POST",
      headers: {
        "api-key": "TltdtJXQKwMmRY4SlvOTLO1TXHGkOBwP"
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
