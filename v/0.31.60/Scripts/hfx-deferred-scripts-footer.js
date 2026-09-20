window.htmlForgeXLibrariesLoaded = true;
// Trigger any deferred component initializations
if (window.htmlForgeXDeferredScripts) {
  window.htmlForgeXDeferredScripts.forEach(function (script) { script(); });
  window.htmlForgeXDeferredScripts = [];
}
