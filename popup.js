var accessToken;
var sheetId = "1lMTB8XEU0POkcJoclLLxZtWp5Yk_fBDAlV_-R2-QZcg";
document.addEventListener("DOMContentLoaded", function () {
  // Load previously saved data into the input fields (if any)
  chrome.storage.local.get(["email"], function (data) {
    document.getElementById("email").value = data.email || "";
  });

  // Save button logic
  document.getElementById("save").addEventListener("click", function () {
    let email = document.getElementById("email").value;
    // Store data
    getAccessToken().then((accessToken) => {
      if (accessToken) {
        getRowByEmail(sheetId, accessToken, email)
          .then((notary_row) => {
            if (notary_row) {
              console.log("Found row:", notary_row);
              chrome.storage.local.set(
                {
                  email: email,
                  folderId: notary_row[4],
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
        alert("Error");
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
    console.log(data);
    const rows = data.values;

    // Find the row with the matching value in the first column
    const matchingRow = rows.find(
      (row) => row.length > 1 && row[1].toLowerCase() === email.toLowerCase()
    );

    if (matchingRow) {
      console.log("Matching row:", matchingRow);
      return matchingRow; // Contains the entire row's data
    } else {
      window.close();
      alert("Please contact someone from KLERO.");
      return null;
    }
  } catch (error) {
    console.log("Error:", error);
    return null;
  }
}

function getAccessToken() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "getAccessToken" },
      function (response) {
        if (response) {
          resolve(response);
        } else {
          resolve(null);
        }
      }
    );
  });
}
