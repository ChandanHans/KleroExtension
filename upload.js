var accessToken;
var parentFolderId1;
var parentFolderId2;

/**
 * Sets the access token by sending a message to the background script.
 */
function setAccessToken() {
  return new Promise(async (resolve) => {
    chrome.runtime.sendMessage(
      { action: "getAccessToken" },
      function (response) {
        if (response) {
          accessToken = response;
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
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
  const button = document.createElement("button");
  button.id = "uploadButton";
  button.innerText = "Loading...";
  button.style.fontWeight = "bold";
  button.style.backgroundColor = "#F44336"; // Red color for initial disabled state
  button.disabled = true;
  button.style.color = "#000";
  button.style.border = "none";
  button.style.width = "225px";
  button.style.height = "45px";

  button.addEventListener("mouseenter", function () {
    if (!button.disabled) {
      button.style.backgroundColor = "#87adbf";
    }
  });

  button.addEventListener("mouseleave", function () {
    if (!button.disabled) {
      button.style.backgroundColor = "#a9d8ef";
    }
  });

  button.addEventListener("click", async function () {
    button.disabled = true;
    button.style.backgroundColor = "#59727d";
    button.innerText = "Uploading...";
    const success = await uploadToDrive();
    if (success) {
      button.innerText = "Uploaded";
      button.style.backgroundColor = "#4CAF50"; // Green color for uploaded state
    } else {
      button.innerText = "Upload Failed";
      button.disabled = false;
      button.style.backgroundColor = "#F44336"; // Red color for failed state
    }
  });
  element.querySelector("section").appendChild(button);
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
    var folderId2 = await getTargetFolderId(name, parentFolderId2);

    if (folderId2) {
      const button = document.getElementById("uploadButton");
      button.innerText = "Uploaded";
      button.disabled = true;
      button.style.backgroundColor = "#4CAF50"; // Green color for uploaded state
      button.removeEventListener("mouseenter", function () {
        button.style.backgroundColor = "#87adbf";
      });
      button.removeEventListener("mouseleave", function () {
        button.style.backgroundColor = "#a9d8ef";
      });
    } else {
      const button = document.getElementById("uploadButton");
      button.disabled = false;
      button.style.backgroundColor = "#a9d8ef"; // Default color for enabled state
      button.innerText = "Upload To Drive";
    }
  }
}

/**
 * Handles page changes by observing mutations in the DOM.
 */
function handlePageChange() {
  observer.observe(document, { childList: true, subtree: true });
}

/**
 * Initializes the appropriate function based on the page content.
 */
function init() {
  const element1 = document.getElementsByClassName(
    "row row-wrapper-has-btm-margin"
  )[0];
  const element2 = document.getElementsByClassName(
    "table table-rwd table-request-display ng-isolate-scope dataTable no-footer"
  )[0];

  if (element1 || element2) {
    chrome.storage.local.get(["folderId1", "folderId2"], async function (data) {
      parentFolderId1 = data.folderId1;
      parentFolderId2 = data.folderId2;
      await setAccessToken();
      if (element1) {
        runFunctionForElement1();
      } else if (element2) {
        runFunctionForElement2();
      }
    });

    observer.disconnect();
  }
}

/**
 * Runs the function for pages containing element1.
 */
function runFunctionForElement1() {
  const element = document.getElementsByClassName(
    "row row-wrapper-has-btm-margin"
  )[0];
  addButton(element);
  checkFolderInTarget();
}

/**
 * Initializes the MutationObserver for rows.
 */
function initObserverForRows() {
  const tableBody = document.querySelector(".table-request-display tbody");

  if (tableBody) {
    const config = { childList: true };

    const callback = function(mutationsList) {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.tagName === 'TR') {
              addMessageCell(node);
            }
          });
        }
      }
    };

    const observer = new MutationObserver(callback);
    observer.observe(tableBody, config);
  }
}

/**
 * Adds a message cell to a row.
 * @param {Element} row - The row to which the message cell will be added.
 */
async function addMessageCell(row) {
  // Check if the row already has a message cell
  if (!row.querySelector('.message-cell')) {
    const newCell = row.insertCell(-1); // Insert at the end of the row
    newCell.textContent = "Loading...";
    newCell.classList.add('message-cell'); // Add a class to identify message cells
    newCell.style.fontWeight = "bold";
    newCell.style.padding = "10px";
    newCell.style.textAlign = "center";

    let name = row.querySelector("td:nth-child(2)").innerText;

    if (await getTargetFolderId(name, parentFolderId1)) {
      newCell.textContent = "Not Uploaded";
      newCell.style.backgroundColor = "#F44336";
      newCell.style.color = "#fff";
    } else if (await getTargetFolderId(name, parentFolderId2)) {
      newCell.textContent = "Uploaded";
      newCell.style.backgroundColor = "#4CAF50";
      newCell.style.color = "#fff";
    } else {
      newCell.textContent = "Not For Klero";
      newCell.style.backgroundColor = "#9E9E9E";
      newCell.style.color = "#fff";
    }
  }
}

/**
 * Runs the function for pages containing element2.
 */
function runFunctionForElement2() {
  initObserverForRows();
  
  const rows = document.querySelectorAll(".table-request-display tbody tr");
  rows.forEach(row => addMessageCell(row));
}

// Use a MutationObserver to wait for the specific element to appear
const observer = new MutationObserver(async function (mutationsList, observer) {
  init();
});

window.addEventListener("popstate", handlePageChange);
handlePageChange();
