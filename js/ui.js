/**
 * Adds the upload button to the page.
 * @param {Element} element - The parent element to which the button will be added.
 */
function addButton(element) {
  if (!document.querySelector("#uploadButton")) {
    const button = document.createElement("button");
    button.id = "uploadButton";
    button.innerText = "Loading...";
    button.style.cssText = `
      font-weight: bold;
      background-color: #F44336;
      color: #fff;
      border: none;
      width: 150px;
      height: 40px;
      border-radius: 4px;
      text-align: center;
      margin: 10px auto;
      display: block;
    `;
    button.disabled = true;
    element.insertAdjacentElement("beforebegin", button);

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
        button.style.backgroundColor = "#3a60a6";
      }
    });
  }
}

/**
 * Checks if a folder exists in the target parent folder (parentFolderId2).
 */
async function checkFolderInTarget() {
  const element = document.querySelector(".table-request-display tbody tr td:nth-child(2)");
  if (element) {
    const name = element.textContent;
    const folderId = await getTargetFolderId(name, folder2Group);
    const button = document.getElementById("uploadButton");

    if (accessToken) {
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
    } else {
      button.innerText = "Error";
    }
  }
}

function hoverEffect(event) {
  const button = event.target;
  if (!button.disabled) {
    button.style.backgroundColor = event.type === "mouseenter" ? "#4d7fdb" : "#3a60a6";
  }
}

/**
 * Adds a message cell to a row.
 * @param {Element} row - The row to which the message cell will be added.
 */
async function addMessageCell(row) {
  if (!row.querySelector(".message-cell")) {
    const newCell = row.insertCell(-1); // Insert at the end of the row
    const messageContainer = document.createElement("span");
    messageContainer.classList.add("message-cell");
    newCell.appendChild(messageContainer);

    // Fixed dimensions
    messageContainer.style.cssText = `
      display: inline-block;
      width: 80px;
      padding: 5px;
      border-radius: 4px;
      font-weight: bold;
      text-align: center;
      color: #fff;
    `;

    const name = row.querySelector("td:nth-child(2)").innerText;

    if (!accessToken) {
      messageContainer.textContent = "Error";
      messageContainer.style.backgroundColor = "#E74C3C";
    } else if (await getTargetFolderId(name, folder1Group)) {
      messageContainer.textContent = "Pending";
      messageContainer.style.backgroundColor = "#E74C3C";
    } else if (await getTargetFolderId(name, folder2Group)) {
      messageContainer.textContent = "Done";
      messageContainer.style.backgroundColor = "#27AE60";
    } else {
      messageContainer.textContent = "N/A";
      messageContainer.style.backgroundColor = "#7F8C8D";
    }
  }
}
