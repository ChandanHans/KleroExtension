let parentFolderId1;
let parentFolderId2;
let folder1Group;
let folder2Group;
let accessToken;

/**
 * Initializes the observer for a given element.
 * @param {string} selector - The CSS selector of the target element.
 * @param {Function} callback - The function to run when the element is found.
 */
function initObserver(selector, callback) {
  const element = document.querySelector(selector);

  if (element) {
    callback();
  } else {
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        callback();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
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
  rows.forEach(row => addMessageCell(row));
}

/**
 * Initializes the MutationObserver for rows.
 */
function initObserverForRows() {
  const tableBody = document.querySelector("#mes-demandes tbody");

  if (tableBody) {
    const observerForRows = new MutationObserver(mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.tagName === "TR") {
              addMessageCell(node);
            }
          });
        }
      }
    });

    observerForRows.observe(tableBody, { childList: true });
  }
}

// Initialize the observers
chrome.storage.local.get(["folderId1", "folderId2"], async data => {
  parentFolderId1 = data.folderId1;
  parentFolderId2 = data.folderId2;
  await setAccessToken();
  folder1Group = await getAllFolders(parentFolderId1);
  folder2Group = await getAllFolders(parentFolderId2);
  initObserver("[ng-if='vm.isPaye'] .row", runFunctionForElement1);
  initObserver("#mes-demandes tbody", runFunctionForElement2);
});

window.addEventListener("popstate", async () => {
  folder1Group = await getAllFolders(parentFolderId1);
  folder2Group = await getAllFolders(parentFolderId2);
  initObserver("[ng-if='vm.isPaye'] .row", runFunctionForElement1);
  initObserver("#mes-demandes tbody", runFunctionForElement2);
});
