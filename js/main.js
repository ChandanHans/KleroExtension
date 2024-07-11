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