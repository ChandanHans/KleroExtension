/**
 * Sets the access token by sending a message to the background script.
 */
function setAccessToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get("password", function (data) {
        if (data.password) {
          chrome.runtime.sendMessage(
            { action: "getAccessToken", password: data.password },
            function (response) {
              if (response) {
                accessToken = response;
                resolve(true);
              } else {
                resolve(false);
              }
            }
          );
        } else {
          resolve(false);
        }
      });
    });
  }