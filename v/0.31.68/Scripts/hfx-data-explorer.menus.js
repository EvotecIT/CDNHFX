// HtmlForgeX explorer menus above a clipping container. A viewport renderer that places the explorer's menus inside a
// container that clips its content (a grid toolbar with overflow: hidden) sets explorer.layeredMenus = true. An open menu
// panel then becomes a manual popover in the browser's top layer, placed under its button (above it when there is more
// room there) and kept inside the viewport, so a short grid no longer cuts it off. Browsers without the popover API get
// the same placement with fixed positioning, which escapes overflow: hidden but not an ancestor with a transform, filter
// or contain. The panel stays in the explorer's DOM, so its theme variables, focus order and events are unchanged.
// Explorers that do not opt in keep the in-place panel.
(function () {
  window.HfxDataExplorerMenus = { install: function (context) {
    var Explorer = context.Explorer, qsa = context.qsa, EDGE = 8, GAP = 6, MINIMUM = 120;

    function layered(panel) {
      try { return panel.matches(':popover-open'); } catch (_) { return false; }
    }
    function placed(panel) { return panel.hasAttribute('popover') || panel.hasAttribute('data-hfx-dx-fixed'); }

    // Places a layered panel by its button within the viewport. The panel's CSS maximum height still caps it; the room
    // left above or below the button caps it further, so a long menu scrolls inside itself instead of leaving the screen.
    function place(button, panel) {
      var box = button.getBoundingClientRect(), width = document.documentElement.clientWidth, height = window.innerHeight;
      panel.style.maxWidth = Math.max(0, width - 2 * EDGE) + 'px';
      panel.style.maxHeight = '';
      var cap = parseFloat(getComputedStyle(panel).maxHeight) || Infinity;
      var natural = panel.offsetHeight, below = height - box.bottom - GAP - EDGE, above = box.top - GAP - EDGE;
      var up = natural > below && above > below, room = Math.min(cap, Math.max(MINIMUM, up ? above : below));
      panel.style.maxHeight = room + 'px';
      var drawn = panel.offsetWidth, tall = panel.offsetHeight;
      panel.style.left = Math.max(EDGE, Math.min(box.right - drawn, width - drawn - EDGE)) + 'px';
      panel.style.top = (up ? box.top - GAP - tall : box.bottom + GAP) + 'px';
    }

    /** Lifts an opened menu panel above its container when the explorer asks for layered menus; false otherwise. */
    Explorer.prototype.layerMenu = function (button, panel) {
      if (!this.layeredMenus) return false;
      var self = this;
      if (typeof panel.showPopover === 'function') {
        panel.setAttribute('popover', 'manual');
        if (!layered(panel)) panel.showPopover();
      } else panel.setAttribute('data-hfx-dx-fixed', '');
      place(button, panel);
      if (!this.menuTracker) {
        // Scrolling inside the open panel moves nothing; a page or container scroll and a resize move its button.
        // Placement waits for the next frame, so a burst of scroll events (virtual rows) costs one layout.
        this.menuTracker = function (event) {
          var open = self.openMenu && self.openMenu.querySelector('.hfx-dx-panel');
          if (event && event.type === 'scroll' && open && open.contains(event.target)) return;
          if (self.menuFrame) return;
          self.menuFrame = requestAnimationFrame(function () { self.menuFrame = 0; self.placeMenus(); });
        };
        window.addEventListener('resize', this.menuTracker);
        window.addEventListener('scroll', this.menuTracker, true);
      }
      return true;
    };

    /**
     * Places the open layered menu by its button again. A renderer calls it after moving the explorer's controls (a
     * replacement grid's toolbar): a popover leaves the top layer when its element moves, so it is shown again here.
     */
    Explorer.prototype.placeMenus = function () {
      var wrap = this.openMenu, panel = wrap && wrap.querySelector('.hfx-dx-panel'), button = wrap && wrap.querySelector('.hfx-dx-btn');
      if (!panel || !button || panel.hidden || !placed(panel)) return;
      if (!panel.isConnected) { this.closeMenus(); return; }
      if (panel.hasAttribute('popover') && !layered(panel)) panel.showPopover();
      place(button, panel);
    };

    /** Takes every layered panel of the explorer out of the top layer and stops following its button. */
    Explorer.prototype.unlayerMenus = function () {
      qsa(this.root, '.hfx-dx-panel[popover]').forEach(function (panel) { if (layered(panel)) panel.hidePopover(); });
      if (this.menuFrame) { cancelAnimationFrame(this.menuFrame); this.menuFrame = 0; }
      if (this.menuTracker) {
        window.removeEventListener('resize', this.menuTracker);
        window.removeEventListener('scroll', this.menuTracker, true);
        this.menuTracker = null;
      }
    };
  } };
})();
