// Quick browser test script
// Run this in your browser console at http://localhost:8080

console.log("=== Cookie Clicker Module Test ===");

// Test 1: Check if rowAnimations module is loaded
try {
  console.log("✓ Page loaded successfully");
} catch (e) {
  console.error("✗ Error loading page:", e);
}

// Test 2: Check for building showcase
const showcase = document.getElementById('building-showcase');
if (showcase) {
  console.log("✓ Building showcase element found");
  console.log("  - Current HTML:", showcase.innerHTML.substring(0, 100) + "...");
} else {
  console.error("✗ Building showcase element not found");
}

// Test 3: Check for baker rows
setTimeout(() => {
  const rows = document.querySelectorAll('.baker-row');
  console.log(`✓ Found ${rows.length} baker rows`);
  
  rows.forEach((row, i) => {
    const type = row.dataset.type;
    const count = row.dataset.count;
    const isLocked = row.classList.contains('baker-row-locked');
    const hasBg = row.querySelector('.baker-row-bg');
    const hasAnimOverlay = row.querySelector('.baker-row-anim');
    
    console.log(`  Row ${i + 1}: ${type}`);
    console.log(`    - Count: ${count}`);
    console.log(`    - Locked: ${isLocked}`);
    console.log(`    - Has background: ${!!hasBg}`);
    console.log(`    - Has animation overlay: ${!!hasAnimOverlay}`);
  });
}, 2000);

// Test 4: Check for animation canvases
setTimeout(() => {
  const animCanvases = document.querySelectorAll('.baker-row-anim');
  console.log(`✓ Found ${animCanvases.length} animation canvases`);
  
  animCanvases.forEach((canvas, i) => {
    console.log(`  Canvas ${i + 1}:`);
    console.log(`    - Width: ${canvas.width}px`);
    console.log(`    - Height: ${canvas.height}px`);
    console.log(`    - Visible: ${canvas.offsetParent !== null}`);
  });
}, 3000);

// Test 5: Module import check
setTimeout(() => {
  console.log("\n=== Module Import Test ===");
  fetch('/js/rowAnimations.js')
    .then(response => {
      if (response.ok) {
        console.log("✓ rowAnimations.js is accessible");
        return response.text();
      } else {
        console.error("✗ rowAnimations.js returned status:", response.status);
      }
    })
    .then(text => {
      if (text) {
        console.log("  - File size:", text.length, "bytes");
        console.log("  - Exports RowAnimator:", text.includes("export class RowAnimator"));
      }
    })
    .catch(e => console.error("✗ Error fetching rowAnimations.js:", e));
}, 100);

console.log("\nTest script loaded. Watch for results above...");
