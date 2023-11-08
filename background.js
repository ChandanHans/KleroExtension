chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getAccessToken") {
    fetch("https://driveuploaderapi.chandanhans.repl.co/get_access_token", {
      method: "GET",
      headers: {
        "api-key": "qHag3wiDzFwgHBTsM9DhPTE6llw5v9SX",
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
