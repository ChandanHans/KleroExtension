/**
 * Fetches all folders under a parent folder from Google Drive.
 * @param {string} parentFolderId - The ID of the parent folder.
 * @returns {Object} - An object mapping folder names to their IDs.
 */
async function getAllFolders(parentFolderId) {
  let nextPageToken = "";
  let foldersObject = {};
  let baseUrl = `https://www.googleapis.com/drive/v3/files`;

  while (true && parentFolderId) {
    let url = new URL(baseUrl);
    url.searchParams.append("q", `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    url.searchParams.append("pageToken", nextPageToken);
    url.searchParams.append("fields", "nextPageToken, files(id, name)");

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

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
 * @param {Array} parentFolderList - The folder list.
 * @returns {string} - The ID of the target folder.
 */
async function getTargetFolderId(name, parentFolderList) {
  var normalizeName = unidecode(name).toLowerCase().replace(/[,\s-]/g, '')
  for(var folders of parentFolderList){
    for (var folder in folders) {
      var normalizeFolderName = unidecode(folder).toLowerCase().replace(/[,\s-]/g, '')
      if (normalizeFolderName.includes(normalizeName)) {
        return folders[folder];
      }
    }
  }
}

/**
 * Fetches the current parent ID of a folder.
 * @param {string} folderId - The ID of the folder.
 * @returns {string|null} - The current parent ID of the folder or null if not found.
 */
async function getCurrentParentId(folderId) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=parents`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.parents ? data.parents[0] : null; // Return the first parent ID
    } else {
      console.log("Error fetching current parent ID:", response.statusText);
      return null;
    }
  } catch (error) {
    console.log("Error fetching current parent ID:", error);
    return null;
  }
}

/**
 * Moves a folder to a new parent folder.
 * @param {string} folderId - The ID of the folder to move.
 * @returns {boolean} - True if the folder was moved successfully, false otherwise.
 */
async function moveFolder(folderId) {
  const currentParentId = await getCurrentParentId(folderId);

  if (!currentParentId) {
    console.log("Current parent ID not found.");
    return false;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?addParents=${parentFolderId2}&removeParents=${currentParentId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      console.log("Folder moved successfully.");
      return true;
    } else {
      console.log("Error moving folder:", response.statusText);
      return false;
    }
  } catch (error) {
    console.log("Error moving folder:", error);
    return false;
  }
}

/**
 * Uploads a file to Google Drive.
 * @param {string} pdfFileURL - The URL of the file to upload.
 * @param {string} folderId - The ID of the target folder.
 */
async function uploadFileToDrive(pdfFileURL, folderId) {
  return new Promise(async (resolve) => {
    try {
      const { fileBlob, fileName } = await downloadFile(pdfFileURL);
      if (fileBlob && fileName) {
        const existingFileId = await checkFileExistence(
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
                Authorization: "Bearer " + accessToken,
                "Content-Type":
                  'multipart/related; boundary="' + boundary + '"',
              },
              body: multipartRequestBody,
            }
          );

          if (response.ok) {
            console.log("PDF file uploaded successfully:");
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
 * Checks if a file with the same name already exists in the target folder.
 * @param {string} folderId - The ID of the target folder.
 * @param {string} fileName - The name of the file to check.
 * @returns {string|null} - The ID of the existing file or null if not found.
 */
async function checkFileExistence(folderId, fileName) {
  const apiUrl = `https://www.googleapis.com/drive/v3/files`;
  const query = `'${folderId}' in parents and name = '${fileName}' and trashed = false`;

  try {
    const response = await fetch(`${apiUrl}?q=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
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
 * Uploads files to Google Drive.
 */
async function uploadToDrive() {
  const element = document.querySelector(".table-request-display tbody tr td:nth-child(2)");
  if (!element) {
    return false;
  }

  const name = element.textContent;
  const folderId = await getTargetFolderId(name, [folder0Group,folder1Group]);
  if (!folderId) {
    if (!accessToken) {
      alert("Please Enter your Email in the Extension.");
    } else {
      alert("Cette succession ne fait pas partie des successions traitées avec Klero Généalogie.\nEn cas d'erreur merci de contacter Louis.fleury@klero.fr");
    }
    return false;
  }

  const anchorElements = document.querySelectorAll('.form-custom a[role="button"]');

  for (const element of anchorElements) {
    const downloadLink = element.getAttribute("href");
    const uploadSuccess = await uploadFileToDrive(downloadLink, folderId);
    if (!uploadSuccess) {
      return false;
    }
  }

  return await moveFolder(folderId);
  
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

function unidecode(str) {
  str = str.normalize('NFD');
  str = str.replace(/[\u0300-\u036f]/g, '');
  let additionalMappings = {
      'œ': 'oe',
      'æ': 'ae',
      'ç': 'c',
      'Œ': 'OE',
      'Æ': 'AE',
      'Ç': 'C'
  };

  str = str.replace(/[\u0153\u0152\u00E6\u00C6\u00E7\u00C7]/g, function(match) {
      return additionalMappings[match] || match;
  });

  return str;
}