// Game State
let cookies = 0;
let cookiesPerClick = 1;
let cookiesPerSecond = 0;

// Upgrade System
let upgrades = [
    { name: "+1 per Click", cost: 10, value: 1 }
];

// Building System
let buildings = [];
for (let i = 0; i < 10; i++) {
    buildings.push({
        name: `Auto-Baker ${i + 1}`,
        cost: 50 * (i + 1),
        cps: 1 * (i + 1),
        count: 0
    });
}

// Click Cookie Function
function clickCookie() {
    cookies += cookiesPerClick;
    updateUI();
}

// Buy Upgrade
function buyUpgrade(index) {
    if (cookies >= upgrades[index].cost) {
        cookies -= upgrades[index].cost;
        cookiesPerClick += upgrades[index].value;
        upgrades[index].cost = Math.floor(upgrades[index].cost * 1.5); // Increase cost
        updateUI();
    }
}

// Buy Building
function buyBuilding(index) {
    if (cookies >= buildings[index].cost) {
        cookies -= buildings[index].cost;
        buildings[index].count++;
        buildings[index].cost = Math.floor(buildings[index].cost * 1.3); // Increase cost
        calculateCPS();
        updateUI();
    }
}

// Calculate Cookies Per Second
function calculateCPS() {
    cookiesPerSecond = buildings.reduce((total, b) => total + (b.count * b.cps), 0);
}

// Update UI
function updateUI() {
    document.getElementById("cookie-count").textContent = cookies;
    document.getElementById("cps-count").textContent = cookiesPerSecond;

    // Update Upgrades
    upgrades.forEach((upgrade, index) => {
        document.getElementById(`upgrade-cost-${index}`).textContent = upgrade.cost;
    });

    // Update Buildings
    let buildingDiv = document.getElementById("buildings");
    buildingDiv.innerHTML = "";
    buildings.forEach((building, index) => {
        let div = document.createElement("div");
        div.classList.add("building");
        div.innerHTML = `
            <span>${building.name} (x${building.count}) - ${building.cps} CPS</span>
            <button onclick="buyBuilding(${index})">Buy (${building.cost})</button>
        `;
        buildingDiv.appendChild(div);
    });
}

// Auto-Generate Cookies
setInterval(() => {
    cookies += cookiesPerSecond;
    updateUI();
}, 1000);

// Load Game
function loadGame() {
    let savedGame = localStorage.getItem("cookieClickerSave");
    if (savedGame) {
        let data = JSON.parse(savedGame);
        cookies = data.cookies;
        cookiesPerClick = data.cookiesPerClick;
        cookiesPerSecond = data.cookiesPerSecond;
        buildings = data.buildings;
    }
    updateUI();
}

// Save Game
setInterval(() => {
    let saveData = {
        cookies,
        cookiesPerClick,
        cookiesPerSecond,
        buildings
    };
    localStorage.setItem("cookieClickerSave", JSON.stringify(saveData));
}, 5000);

// Click Event
document.getElementById("cookie-button").addEventListener("click", clickCookie);

// Initialize
loadGame();
updateUI();
