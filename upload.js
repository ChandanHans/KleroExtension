var accessToken;
var parentFolderId1;
var parentFolderId2;

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

async function getTargetFolderId(name, parentFolderId) {
  var folders = await getAllFolders(parentFolderId);
  for (var folder in folders) {
    if (folder.toLowerCase().includes(name.toLowerCase())) {
      return folders[folder];
    }
  }
}

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

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

function handlePageChange() {
  observer.observe(document, { childList: true, subtree: true });
}

// Use a MutationObserver to wait for the specific element to appear
const observer = new MutationObserver(async function (mutationsList, observer) {
  const element = document.getElementsByClassName(
    "row row-wrapper-has-btm-margin"
  )[0];

  if (element) {
    const element = document.getElementsByClassName(
      "row row-wrapper-has-btm-margin"
    )[0];
    if (element) {
      addButton(element);
      chrome.storage.local.get(["folderId1", "folderId2"], async function (data) {
        parentFolderId1 = data.folderId1;
        parentFolderId2 = data.folderId2;
        await setAccessToken();     
        await checkFolderInTarget();
      });
    }
    observer.disconnect();
  }
});

window.addEventListener("popstate", handlePageChange);
handlePageChange();
