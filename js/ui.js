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
    button.style.backgroundColor = "#F44336";
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
        button.style.backgroundColor = "#3a60a6";
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
    var folderId = await getTargetFolderId(name, folder2Group);
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

    if (!accessToken) {
      messageContainer.textContent = "Error"; // Abbreviation for "Not Uploaded"
      messageContainer.style.backgroundColor = "#E74C3C"; // Example theme color for not uploaded
    } else if (await getTargetFolderId(name, folder1Group)) {
      messageContainer.textContent = "Pending"; // Abbreviation for "Not Uploaded"
      messageContainer.style.backgroundColor = "#E74C3C"; // Example theme color for not uploaded
    } else if (await getTargetFolderId(name, folder2Group)) {
      messageContainer.textContent = "Done";
      messageContainer.style.backgroundColor = "#27AE60"; // Example theme color for uploaded
    } else {
      messageContainer.textContent = "N/A"; // Abbreviation for "Not For Klero"
      messageContainer.style.backgroundColor = "#7F8C8D"; // Example theme color for not applicable
    }
  }
}
