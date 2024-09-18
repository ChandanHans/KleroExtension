// popup.js

var sheetId = "1lMTB8XEU0POkcJoclLLxZtWp5Yk_fBDAlV_-R2-QZcg";

document.addEventListener("DOMContentLoaded", function () {
  // Load previously saved data into the input fields (if any)
  chrome.storage.local.get(["email", "password"], function (data) {
    document.getElementById("email").value = data.email || "";
    document.getElementById("password").value = data.password || "";
  });

  // Save button logic
  document.getElementById("save").addEventListener("click", function () {
    let email = document.getElementById("email").value;
    let password = document.getElementById("password").value;
    // Store data
    getAccessToken(password).then((accessToken) => {
      if (accessToken) {
        getRowByEmail(sheetId, accessToken, email)
          .then((notaryData) => {
            if (notaryData) {
              console.log("Found data:", notaryData);
              chrome.storage.local.set(
                {
                  email: email,
                  password: password,
                  folderId1: notaryData["2.3"]||"",
                  folderId2: notaryData["2.4"]||"",
                  folderId3: notaryData["3.1"]||"",
                  folderId4: notaryData["3.2"]||"",
                  folderId5: notaryData["4"]||"",
                },
                function () {
                  window.close();
                }
              );
            } else {
              console.log("No matching data found");
            }
          })
          .catch((error) => {
            console.log("Error fetching data:", error);
          });
      } else {
        alert("Wrong password!");
      }
    });
  });
});

async function getRowByEmail(sheetId, accessToken, email) {
  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=Sheet1`;

  try {
    const response = await fetch(sheetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Error fetching data:", response.statusText);
    }

    const data = await response.json();
    const rows = data.valueRanges[0].values;

    // Find the row with the matching email in the second column
    const headers = rows[0];
    const emailIndex = headers.indexOf("Email");
    const matchingRow = rows.find(
      (row) => row[emailIndex] && row[emailIndex].toLowerCase() === email.toLowerCase()
    );

    if (matchingRow) {
      let notaryData = {};
      headers.forEach((header, index) => {
        if (index > 1) { // Skip "Name" and "Email" columns
          notaryData[header] = matchingRow[index];
        }
      });
      return notaryData; // Contains the data indexed by shortcut names
    } else {
      alert("Please check your email or contact someone from KLERO.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

function getAccessToken(password) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "getAccessToken", password: password, new: true },
      function (response) {
        if (response) {
          resolve(response.accessToken);
        } else {
          resolve(null);
        }
      }
    );
  });
}
