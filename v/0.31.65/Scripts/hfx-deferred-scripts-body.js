window.htmlForgeXLibrariesLoaded = false;
window.htmlForgeXDeferredScripts = [];

// Helper function to defer script execution until libraries are loaded
function deferUntilLibrariesLoaded(callback) {
  if (window.htmlForgeXLibrariesLoaded) {
    callback();
  } else {
    window.htmlForgeXDeferredScripts.push(callback);
  }
}
