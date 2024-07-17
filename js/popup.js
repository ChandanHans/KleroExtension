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
          .then((notary_row) => {
            if (notary_row) {
              console.log("Found row:", notary_row);
              chrome.storage.local.set(
                {
                  email: email,
                  password: password,
                  folderId1: notary_row[4],
                  folderId2: notary_row[5],
                },
                function () {
                  window.close();
                }
              );
            } else {
              console.log("No matching row found");
            }
          })
          .catch((error) => {
            console.log("Error fetching row:", error);
          });
      } else {
        alert("Wrong password!");
      }
    });
  });
});

async function getRowByEmail(sheetId, accessToken, email) {
  // The A1 notation of the range to search for value
  const range = "A:Z";

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?majorDimension=ROWS`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Error fetching data:", response.statusText);
    }

    const data = await response.json();
    const rows = data.values;

    // Find the row with the matching value in the first column
    const matchingRow = rows.find(
      (row) => row.length > 1 && row[1].toLowerCase() === email.toLowerCase()
    );

    if (matchingRow) {
      return matchingRow; // Contains the entire row's data
    } else {
      window.close();
      alert("Please check your email or contact someone from KLERO.");
      return null;
    }
  } catch (error) {
    return null;
  }
}

function getAccessToken(password) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "getAccessToken", password: password , new : true},
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
