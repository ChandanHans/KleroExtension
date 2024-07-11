var accessToken;
var parentFolderId1;
var parentFolderId2;

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

/**
 * Fetches all folders under a parent folder from Google Drive.
 * @param {string} parentFolderId - The ID of the parent folder.
 * @returns {Object} - An object mapping folder names to their IDs.
 */
async function getAllFolders(parentFolderId) {
  let nextPageToken = "";
  var foldersObject = {};
  while (true) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${parentFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&pageToken=${nextPageToken}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const folders = data.files;
        if (folders.length > 0) {
          folders.forEach((folder) => {
            foldersObject[folder.name] = folder.id;
          });
        }

        if (data.nextPageToken) {
          nextPageToken = data.nextPageToken;
        } else {
          break;
        }
      } else {
        console.log("Error listing folders:", response.statusText);
        break;
      }
    } catch (error) {
      console.log("Error listing folders:", error);
      break;
    }
  }
  return foldersObject;
}

/**
 * Gets the folder ID for a target folder by name.
 * @param {string} name - The name of the target folder.
 * @param {string} parentFolderId - The ID of the parent folder.
 * @returns {string} - The ID of the target folder.
 */
async function getTargetFolderId(name, parentFolderId) {
  var folders = await getAllFolders(parentFolderId);
  for (var folder in folders) {
    if (folder.toLowerCase().includes(name.toLowerCase())) {
      return folders[folder];
    }
  }
}

/**
 * Moves a folder from parentFolderId1 to parentFolderId2.
 * @param {string} folderId - The ID of the folder to move.
 */
async function moveFolder(folderId) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?addParents=${parentFolderId2}&removeParents=${parentFolderId1}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      console.log("Folder moved successfully.");
    } else {
      console.log("Error moving folder:", response.statusText);
    }
  } catch (error) {
    console.log("Error moving folder:", error);
  }
}

/**
 * Uploads files to Google Drive.
 */
async function uploadToDrive() {
  return new Promise(async (resolve) => {
    const element = document.querySelector(
      ".table-request-display tbody tr td:nth-child(2)"
    );
    if (element) {
      var name = element.textContent;
      var folderId = await getTargetFolderId(name, parentFolderId1);
      console.log(folderId);

      if (folderId) {
        const anchorElements = document.querySelectorAll(
          '.form-custom a[role="button"]'
        );
        for (let i = 0; i < anchorElements.length; i++) {
          const element = anchorElements[i];
          const downloadLink = element.getAttribute("href");
          await uploadFileToDrive(accessToken, downloadLink, folderId);
        }
        if (folderId) {
          await moveFolder(folderId);
        }
        resolve(true);
      } else {
        if (!parentFolderId1 && !parentFolderId2) {
          alert("Please Enter your Email in the Extension.");
        } else {
          alert("Folder not found for this Client.");
        }
        resolve(false);
      }
    } else {
      resolve(false);
    }
  });
}

/**
 * Extracts the file name from the response headers.
 * @param {Response} response - The fetch response.
 * @returns {string|null} - The file name or null if not found.
 */
function getFileName(response) {
  const contentDisposition = response.headers.get("Content-Disposition");
  if (contentDisposition) {
    const matches = contentDisposition.match(/filename=(.+)/);
    if (matches && matches.length > 1) {
      return matches[1];
    }
  }
  return null;
}

/**
 * Downloads a file from the given URL.
 * @param {string} url - The URL of the file to download.
 * @returns {Object} - An object containing the file blob and file name.
 */
async function downloadFile(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        "Failed to fetch PDF file: " +
          response.status +
          " " +
          response.statusText
      );
    }

    const fileName = getFileName(response);
    const fileBlob = await response.blob();
    return { fileBlob, fileName };
  } catch (error) {
    console.log("Error downloading PDF file:", error);
    return { fileBlob: null, fileName: null };
  }
}

/**
 * Checks if a file with the same name already exists in the target folder.
 * @param {string} token - The access token.
 * @param {string} folderId - The ID of the target folder.
 * @param {string} fileName - The name of the file to check.
 * @returns {string|null} - The ID of the existing file or null if not found.
 */
async function checkFileExistence(token, folderId, fileName) {
  const apiUrl = `https://www.googleapis.com/drive/v3/files`;
  const query = `'${folderId}' in parents and name = '${fileName}' and trashed = false`;

  try {
    const response = await fetch(`${apiUrl}?q=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.files && result.files.length > 0) {
        return result.files[0].id;
      }
    } else {
      console.log("Error checking file existence:", response.statusText);
    }
  } catch (error) {
    console.log("Error checking file existence:", error);
  }

  return null;
}

/**
 * Uploads a file to Google Drive.
 * @param {string} token - The access token.
 * @param {string} pdfFileURL - The URL of the file to upload.
 * @param {string} folderId - The ID of the target folder.
 */
async function uploadFileToDrive(token, pdfFileURL, folderId) {
  return new Promise(async (resolve) => {
    try {
      const { fileBlob, fileName } = await downloadFile(pdfFileURL);
      if (fileBlob && fileName) {
        const existingFileId = await checkFileExistence(
          token,
          folderId,
          fileName
        );
        if (existingFileId) {
          console.log("File already exists. Skipping upload.");
          resolve(true);
        } else {
          const boundary = "-------314159265358979323846";
          const delimiter = "\r\n--" + boundary + "\r\n";
          const closeDelim = "\r\n--" + boundary + "--";

          const metadata = {
            name: fileName,
            mimeType: "application/pdf",
            parents: [folderId],
          };

          const base64Data = await blobToBase64(fileBlob);

          const multipartRequestBody =
            delimiter +
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
            JSON.stringify(metadata) +
            delimiter +
            "Content-Type: " +
            metadata.mimeType +
            "\r\n" +
            "Content-Transfer-Encoding: base64\r\n\r\n" +
            base64Data +
            closeDelim;

          const response = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
              method: "POST",
              headers: {
                Authorization: "Bearer " + token,
                "Content-Type":
                  'multipart/related; boundary="' + boundary + '"',
              },
              body: multipartRequestBody,
            }
          );

          if (response.ok) {
            const result = await response.json();
            console.log("PDF file uploaded successfully:", result);
            resolve(true);
          } else {
            console.log("Error uploading PDF file:", response.statusText);
            resolve(false);
          }
        }
      } else {
        console.log("File download failed.");
        resolve(false);
      }
    } catch (error) {
      console.log("Error uploading PDF file:", error);
      resolve(false);
    }
  });
}

/**
 * Converts a Blob to a base64 string.
 * @param {Blob} blob - The Blob to convert.
 * @returns {Promise<string>} - The base64 string.
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Adds the upload button to the page.
 * @param {Element} element - The parent element to which the button will be added.
 */
function addButton(element) {
  if (!document.querySelector("#uploadButton")) {
    const button = document.createElement("button");
    element.insertAdjacentElement("beforebegin", button);
    button.id = "uploadButton";
    button.innerText = "Loading...";
    button.style.fontWeight = "bold";
    button.style.backgroundColor = "#F44336"; // Light blue color for the default state
    button.disabled = true;
    button.style.color = "#fff"; // White text color
    button.style.border = "none";
    button.style.width = "150px"; // Adjusted width to be smaller
    button.style.height = "40px"; // Adjusted height to be smaller
    button.style.borderRadius = "4px"; // Rounded corners
    button.style.textAlign = "center"; // Center text
    button.style.margin = "10px auto"; // Center horizontally
    button.style.display = "block"; // Center horizontally

    button.addEventListener("click", async function () {
      button.disabled = true;
      button.style.backgroundColor = "#59727d";
      button.innerText = "Uploading...";
      const success = await uploadToDrive();
      if (success) {
        button.innerText = "Done";
        button.style.backgroundColor = "#4CAF50"; // Green color for uploaded state
      } else {
        button.innerText = "Failed";
        button.disabled = false;
        button.style.backgroundColor = "#F44336"; // Red color for failed state
      }
    });
  }
}

/**
 * Checks if a folder exists in the target parent folder (parentFolderId2).
 */
async function checkFolderInTarget() {
  const element = document.querySelector(
    ".table-request-display tbody tr td:nth-child(2)"
  );
  if (element) {
    var name = element.textContent;
    var folderId = await getTargetFolderId(name, parentFolderId2);

    const button = document.getElementById("uploadButton");

    if (folderId) {
      button.innerText = "Done";
      button.disabled = true;
      button.style.backgroundColor = "#4CAF50"; // Green color for uploaded state
      button.removeEventListener("mouseenter", hoverEffect);
      button.removeEventListener("mouseleave", hoverEffect);
    } else {
      button.innerText = "Upload";
      button.disabled = false;
      button.style.backgroundColor = "#3a60a6"; // Default color for enabled state
      button.addEventListener("mouseenter", hoverEffect);
      button.addEventListener("mouseleave", hoverEffect);
    }
  }
}

function hoverEffect(event) {
  const button = event.target;
  if (!button.disabled) {
    if (event.type === "mouseenter") {
      button.style.backgroundColor = "#4d7fdb";
    } else {
      button.style.backgroundColor = "#3a60a6"; // Match the default color
    }
  }
}

/**
 * Adds a message cell to a row.
 * @param {Element} row - The row to which the message cell will be added.
 */
async function addMessageCell(row) {
  // Check if the row already has a message cell
  if (!row.querySelector(".message-cell")) {
    const newCell = row.insertCell(-1); // Insert at the end of the row
    const messageContainer = document.createElement("span");
    messageContainer.classList.add("message-cell"); // Add a class to identify message cells
    newCell.appendChild(messageContainer);

    // Fixed dimensions
    messageContainer.style.display = "inline-block";
    messageContainer.style.width = "80px"; // Fixed width
    messageContainer.style.padding = "5px"; // Adjust padding as needed
    messageContainer.style.borderRadius = "4px"; // Rounded corners for a softer look
    messageContainer.style.fontWeight = "bold";
    messageContainer.style.textAlign = "center"; // Center the text
    messageContainer.style.color = "#fff"; // White text color

    let name = row.querySelector("td:nth-child(2)").innerText;

    if (await getTargetFolderId(name, parentFolderId1)) {
      messageContainer.textContent = "Pending"; // Abbreviation for "Not Uploaded"
      messageContainer.style.backgroundColor = "#E74C3C"; // Example theme color for not uploaded
    } else if (await getTargetFolderId(name, parentFolderId2)) {
      messageContainer.textContent = "Done";
      messageContainer.style.backgroundColor = "#27AE60"; // Example theme color for uploaded
    } else {
      messageContainer.textContent = "N/A"; // Abbreviation for "Not For Klero"
      messageContainer.style.backgroundColor = "#7F8C8D"; // Example theme color for not applicable
    }
  }
}

/**
 * Initializes the observer for the `[ng-if='vm.isPaye'] .row` element.
 */
function initObserverForElement1() {
  const element = document.querySelector("[ng-if='vm.isPaye'] .row");

  if (element) {
    runFunctionForElement1();
  } else {
    const observerForElement1 = new MutationObserver(() => {
      const element = document.querySelector("[ng-if='vm.isPaye'] .row");
      if (element) {
        runFunctionForElement1();
        observerForElement1.disconnect();
      }
    });
    observerForElement1.observe(document, { childList: true, subtree: true });
  }
}

/**
 * Initializes the observer for the `#mes-demandes tbody` element.
 */
function initObserverForElement2() {
  const tableBody = document.querySelector("#mes-demandes tbody");

  if (tableBody) {
    runFunctionForElement2();
  } else {
    const observerForElement2 = new MutationObserver(() => {
      const tableBody = document.querySelector("#mes-demandes tbody");
      if (tableBody) {
        runFunctionForElement2();
        observerForElement2.disconnect();
      }
    });
    observerForElement2.observe(document, { childList: true, subtree: true });
  }
}

/**
 * Runs the function for pages containing element1.
 */
function runFunctionForElement1() {
  const element = document.querySelector("[ng-if='vm.isPaye'] .row");
  addButton(element);
  checkFolderInTarget();
}

/**
 * Runs the function for pages containing element2.
 */
function runFunctionForElement2() {
  initObserverForRows();

  const rows = document.querySelectorAll("#mes-demandes tbody tr");
  rows.forEach((row) => addMessageCell(row));
}

/**
 * Initializes the MutationObserver for rows.
 */
function initObserverForRows() {
  const tableBody = document.querySelector("#mes-demandes tbody");

  if (tableBody) {
    const config = { childList: true };

    const callback = function (mutationsList) {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.tagName === "TR") {
              addMessageCell(node);
            }
          });
        }
      }
    };

    const observerForRows = new MutationObserver(callback);
    observerForRows.observe(tableBody, config);
  }
}

// Initialize the observers
chrome.storage.local.get(["folderId1", "folderId2"], function (data) {
  parentFolderId1 = data.folderId1;
  parentFolderId2 = data.folderId2;
  setAccessToken().then(() => {
    initObserverForElement1();
    initObserverForElement2();
  });
});

window.addEventListener("popstate", function () {
  initObserverForElement1();
  initObserverForElement2();
});
