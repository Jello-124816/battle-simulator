console.log("JS loaded"); // debug message

// ==========================
// ----- Create Army --------
// ==========================
function createArmy(prefix, defaultName) {

    const nameField = prefix === "a1" ? "army1-name" : "army2-name";
    const name = document.getElementById(nameField).value || defaultName;

    const make = (type) => ({
        type,
        hpPerUnit: Number(document.getElementById(`${prefix}-${type}-hp`).value),
        atkPerUnit: Number(document.getElementById(`${prefix}-${type}-atk`).value),
        atkSpeed: Number(document.getElementById(`${prefix}-${type}-aspd`).value),
        defPerUnit: Number(document.getElementById(`${prefix}-${type}-def`).value),
        units: Number(document.getElementById(`${prefix}-${type}-units`).value),
        pos: document.getElementById(`${prefix}-${type}-pos`).value,

        // NEW SKILL:
        buffPercent: Number(document.getElementById(`${prefix}-${type}-buff`).value),
        buffFrequency: Number(document.getElementById(`${prefix}-${type}-freq`).value),
        attackCounter: 0, // track how many attacks occurred

        remainingHp: 0
    });

    const inf = make("inf");
    const tank = make("tank");
    const sni = make("sni");

    inf.remainingHp = inf.hpPerUnit * inf.units;
    tank.remainingHp = tank.hpPerUnit * tank.units;
    sni.remainingHp = sni.hpPerUnit * sni.units;

    return { name, groups: [inf, tank, sni] };
}


// ==========================
// ----- Simulation ---------
// ==========================

let army1, army2;
let timer = null;
let currentSecond = 0;

const priority = ["front", "mid", "back"];

function startSimulation() {

    army1 = createArmy("a1", "Army 1");
    army2 = createArmy("a2", "Army 2");

    document.getElementById("army1-status-title").textContent = army1.name + " Status";
    document.getElementById("army2-status-title").textContent = army2.name + " Status";

    currentSecond = 0;
    document.getElementById("battle-log").innerHTML = "";
    updateStatus();

    document.getElementById("start-btn").disabled = true;

    timer = setInterval(simulationStep, 1000);
}

function resetSimulation() {
    if (timer) clearInterval(timer);

    document.getElementById("start-btn").disabled = false;

    document.getElementById("battle-log").innerHTML = "";
    document.getElementById("army1-status").innerHTML = "";
    document.getElementById("army2-status").innerHTML = "";
}


// Select alive enemy target by priority
function pickTarget(enemy) {
    for (let p of priority) {
        let g = enemy.groups.find(gr => gr.pos === p && alive(gr) > 0);
        if (g) return g;
    }
    return null;
}

function alive(g) {
    return Math.floor(g.remainingHp / g.hpPerUnit);
}

function dead(army) {
    return army.groups.every(g => alive(g) <= 0);
}


// ==========================
// ---- One Step Per Second -
// ==========================

function simulationStep() {

    currentSecond++;

    if (dead(army1) || dead(army2)) return endBattle();

    const dmgTo1 = new Map();
    const dmgTo2 = new Map();

    dealDamage(army1, army2, dmgTo2);
    dealDamage(army2, army1, dmgTo1);

    applyDamage(dmgTo1);
    applyDamage(dmgTo2);

    updateStatus();
    logTick();

    if (dead(army1) || dead(army2)) endBattle();
}



// Apply all atk → defender
function dealDamage(attacker, defender, map) {
    attacker.groups.forEach(g => {

        const unitsAlive = alive(g);
        if (unitsAlive <= 0) return;

        const target = pickTarget(defender);
        if (!target) return;

        // Count attack
        g.attackCounter++;

        // Base attack = attack per unit × alive units
        let totalAttackPower = g.atkPerUnit * unitsAlive;

        // SKILL ACTIVATION
        if (g.buffFrequency > 0 && g.attackCounter % g.buffFrequency === 0) {
            totalAttackPower *= (1 + g.buffPercent / 100);
        }

        const totalHits = g.atkSpeed;

        // Total DPS
        const baseDamage = totalHits * totalAttackPower;

        const reduced = baseDamage * (1 - 0.005 * target.defPerUnit);

        map.set(target, (map.get(target) || 0) + reduced);
    });
}




function applyDamage(map) {
    map.forEach((dmg, grp) => {
        grp.remainingHp -= dmg;
        if (grp.remainingHp < 0) grp.remainingHp = 0;
    });
}


// ==========================
// ----- UI Output ----------
// ==========================

function updateStatus() {
    document.getElementById("army1-status").innerHTML = htmlStatus(army1);
    document.getElementById("army2-status").innerHTML = htmlStatus(army2);
}

function htmlStatus(army) {
    return army.groups.map(g => 
        `<b>${g.type.toUpperCase()}</b> — Units: ${alive(g)} | HP: ${g.remainingHp.toFixed(1)}`
    ).join("<br>");
}

function logTick() {
    const log = document.getElementById("battle-log");
    const line = document.createElement("div");

    line.textContent =
        `t=${currentSecond}s | ` +
        `${army1.name}: ${army1.groups.map(g => `${g.type}:${alive(g)}`).join(", ")}  |  ` +
        `${army2.name}: ${army2.groups.map(g => `${g.type}:${alive(g)}`).join(", ")}`;

    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

function endBattle() {

    clearInterval(timer);
    document.getElementById("start-btn").disabled = false;

    const log = document.getElementById("battle-log");
    const end = document.createElement("div");

    if (dead(army1) && dead(army2))
        end.innerHTML = "<b>Draw — both armies destroyed.</b>";
    else if (dead(army1))
        end.innerHTML = `<b>${army2.name} wins!</b>`;
    else
        end.innerHTML = `<b>${army1.name} wins!</b>`;

    log.appendChild(end);
    log.scrollTop = log.scrollHeight;
}


// Event listeners
document.getElementById("start-btn").addEventListener("click", startSimulation);
document.getElementById("reset-btn").addEventListener("click", resetSimulation);
