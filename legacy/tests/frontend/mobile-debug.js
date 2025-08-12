// Mobile Debug Tool for R3 Theme
// This script helps identify and debug mobile styling issues

(function() {
  'use strict';

  // Create debug panel
  const debugPanel = document.createElement('div');
  debugPanel.id = 'mobile-debug-panel';
  debugPanel.innerHTML = `
    <div class="debug-header">
      <h3>Mobile Debug Tool</h3>
      <button class="debug-close">×</button>
    </div>
    <div class="debug-content">
      <div class="debug-section">
        <h4>Viewport Info</h4>
        <div id="viewport-info"></div>
      </div>
      <div class="debug-section">
        <h4>Overflow Detection</h4>
        <div id="overflow-info"></div>
      </div>
      <div class="debug-section">
        <h4>Layout Issues</h4>
        <div id="layout-issues"></div>
      </div>
      <div class="debug-actions">
        <button id="check-overflow">Check Overflow</button>
        <button id="highlight-issues">Highlight Issues</button>
        <button id="test-viewports">Test Viewports</button>
      </div>
    </div>
  `;

  // Add styles
  const styles = `
    #mobile-debug-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      border: 2px solid #caa7eb;
      border-radius: 8px;
      z-index: 99999;
      font-family: monospace;
      font-size: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: #caa7eb;
      color: black;
    }

    .debug-header h3 {
      margin: 0;
      font-size: 14px;
    }

    .debug-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
    }

    .debug-content {
      padding: 15px;
      overflow-y: auto;
      flex: 1;
    }

    .debug-section {
      margin-bottom: 20px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    .debug-section h4 {
      margin: 0 0 10px 0;
      color: #caa7eb;
      font-size: 12px;
    }

    .debug-info {
      line-height: 1.6;
    }

    .debug-error {
      color: #ff6b6b;
      font-weight: bold;
    }

    .debug-warning {
      color: #feca57;
    }

    .debug-success {
      color: #48dbfb;
    }

    .debug-actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }

    .debug-actions button {
      flex: 1;
      padding: 8px;
      background: #caa7eb;
      color: black;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: bold;
    }

    .debug-actions button:hover {
      background: #fff;
    }

    .debug-highlight {
      outline: 3px solid #ff6b6b !important;
      outline-offset: -3px;
    }

    @media (max-width: 425px) {
      #mobile-debug-panel {
        width: calc(100% - 40px);
        right: 20px;
        left: 20px;
      }
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
  document.body.appendChild(debugPanel);

  // Update viewport info
  function updateViewportInfo() {
    const info = document.getElementById('viewport-info');
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const dpr = window.devicePixelRatio || 1;
    
    info.innerHTML = `
      <div class="debug-info">
        <div>Viewport: ${vw} × ${vh}px</div>
        <div>Device Pixel Ratio: ${dpr}</div>
        <div>Document Width: ${document.documentElement.scrollWidth}px</div>
        <div>Body Width: ${document.body.scrollWidth}px</div>
        <div class="${document.body.scrollWidth > vw ? 'debug-error' : 'debug-success'}">
          Horizontal Scroll: ${document.body.scrollWidth > vw ? 'YES' : 'NO'}
        </div>
      </div>
    `;
  }

  // Check for overflow elements
  function checkOverflow() {
    const overflowInfo = document.getElementById('overflow-info');
    const layoutIssues = document.getElementById('layout-issues');
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const overflowElements = [];
    const layoutProblems = [];

    // Remove previous highlights
    document.querySelectorAll('.debug-highlight').forEach(el => {
      el.classList.remove('debug-highlight');
    });

    // Check all elements
    document.querySelectorAll('*').forEach(element => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      
      // Check for horizontal overflow
      if (rect.right > vw || rect.left < 0) {
        overflowElements.push({
          element: element,
          tag: element.tagName,
          class: element.className,
          id: element.id,
          left: rect.left,
          right: rect.right,
          width: rect.width
        });
      }

      // Check for problematic CSS
      if (styles.width === '100vw' && element !== document.body && element !== document.documentElement) {
        layoutProblems.push({
          element: element,
          issue: 'Uses 100vw width',
          tag: element.tagName,
          selector: element.className || element.id || element.tagName
        });
      }

      // Check for negative margins that might cause issues
      const marginLeft = parseFloat(styles.marginLeft);
      const marginRight = parseFloat(styles.marginRight);
      if (marginLeft < -50 || marginRight < -50) {
        layoutProblems.push({
          element: element,
          issue: `Large negative margin: ${marginLeft}px / ${marginRight}px`,
          tag: element.tagName,
          selector: element.className || element.id || element.tagName
        });
      }
    });

    // Display overflow elements
    if (overflowElements.length > 0) {
      overflowInfo.innerHTML = `
        <div class="debug-error">Found ${overflowElements.length} overflowing elements:</div>
        ${overflowElements.slice(0, 5).map(item => `
          <div class="debug-warning">
            ${item.tag}${item.id ? '#' + item.id : ''}${item.class ? '.' + item.class.split(' ')[0] : ''}
            <br>Position: ${Math.round(item.left)}px - ${Math.round(item.right)}px
            <br>Width: ${Math.round(item.width)}px
          </div>
        `).join('')}
        ${overflowElements.length > 5 ? `<div>... and ${overflowElements.length - 5} more</div>` : ''}
      `;
    } else {
      overflowInfo.innerHTML = '<div class="debug-success">No overflow detected!</div>';
    }

    // Display layout issues
    if (layoutProblems.length > 0) {
      layoutIssues.innerHTML = `
        <div class="debug-warning">Found ${layoutProblems.length} potential issues:</div>
        ${layoutProblems.slice(0, 5).map(item => `
          <div>
            ${item.selector}: ${item.issue}
          </div>
        `).join('')}
      `;
    } else {
      layoutIssues.innerHTML = '<div class="debug-success">No layout issues detected!</div>';
    }

    return { overflowElements, layoutProblems };
  }

  // Highlight problematic elements
  function highlightIssues() {
    const { overflowElements, layoutProblems } = checkOverflow();
    
    [...overflowElements, ...layoutProblems].forEach(item => {
      if (item.element) {
        item.element.classList.add('debug-highlight');
      }
    });

    setTimeout(() => {
      document.querySelectorAll('.debug-highlight').forEach(el => {
        el.classList.remove('debug-highlight');
      });
    }, 5000);
  }

  // Test different viewport sizes
  function testViewports() {
    const viewports = [
      { name: 'iPhone 12 Pro', width: 390 },
      { name: 'iPhone 13 mini', width: 375 },
      { name: 'iPhone SE', width: 320 },
      { name: 'iPad', width: 768 },
      { name: 'Desktop', width: 1400 }
    ];

    let currentIndex = 0;
    const originalWidth = window.innerWidth;

    function testNext() {
      if (currentIndex < viewports.length) {
        const viewport = viewports[currentIndex];
        // Note: This won't actually resize the viewport, but will help identify issues
        // console.log(`Testing ${viewport.name} (${viewport.width}px)`);
        checkOverflow();
        currentIndex++;
        setTimeout(testNext, 1000);
      }
    }

    testNext();
  }

  // Event listeners
  document.querySelector('.debug-close').addEventListener('click', () => {
    debugPanel.remove();
    styleSheet.remove();
  });

  document.getElementById('check-overflow').addEventListener('click', checkOverflow);
  document.getElementById('highlight-issues').addEventListener('click', highlightIssues);
  document.getElementById('test-viewports').addEventListener('click', testViewports);

  // Initial update
  updateViewportInfo();
  checkOverflow();

  // Update on resize
  window.addEventListener('resize', () => {
    updateViewportInfo();
    checkOverflow();
  });

  // Monitor for dynamic content changes
  const observer = new MutationObserver(() => {
    updateViewportInfo();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();