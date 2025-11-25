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
    penPerUnit: Number(document.getElementById(`${prefix}-${type}-pen`).value),
    units: Number(document.getElementById(`${prefix}-${type}-units`).value),
    pos: document.getElementById(`${prefix}-${type}-pos`).value,
});


    const inf  = make("inf");
    const tank = make("tank");
    const sni  = make("sni");

    // initial HP
    inf.remainingHp  = inf.hpPerUnit  * inf.units;
    tank.remainingHp = tank.hpPerUnit * tank.units;
    sni.remainingHp  = sni.hpPerUnit  * sni.units;

    // required for skill system
    inf.armyPrefix  = prefix;
    tank.armyPrefix = prefix;
    sni.armyPrefix  = prefix;

    inf._localCounter  = 0;
    tank._localCounter = 0;
    sni._localCounter  = 0;

    inf.attackCounter  = 0;
    tank.attackCounter = 0;
    sni.attackCounter  = 0;

    // order: tank, inf, sni
    return { name, groups: [tank, inf, sni] };
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
    return g.hpPerUnit > 0
        ? Math.max(0, Math.floor(g.remainingHp / g.hpPerUnit))
        : 0;
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

    // Save previous alive counts (index 0=tank,1=inf,2=sni)
    previousArmy1 = {
        tank: alive(army1.groups[0]),
        inf:  alive(army1.groups[1]),
        sni:  alive(army1.groups[2])
    };

    previousArmy2 = {
        tank: alive(army2.groups[0]),
        inf:  alive(army2.groups[1]),
        sni:  alive(army2.groups[2])
    };

    const dmgTo1 = new Map();
    const dmgTo2 = new Map();

    dealDamage(army1, army2, dmgTo2);
    dealDamage(army2, army1, dmgTo1);

    applyDamage(dmgTo1);
    applyDamage(dmgTo2);

    // compute lost units this second
    army1.groups.forEach(g => {
        const now = alive(g);
        g.lostLast = previousArmy1[g.type] - now;
    });

    army2.groups.forEach(g => {
        const now = alive(g);
        g.lostLast = previousArmy2[g.type] - now;
    });

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

        // Apply army skill
        const armySkill = window.skills && window.skills[g.armyPrefix];
        if (armySkill && armySkill.type === "increase-dmg") {
            g._localCounter++;

            if (armySkill.frequency > 0 && g._localCounter % armySkill.frequency === 0) {
                totalAttackPower *= (1 + armySkill.percent / 100);
            }
        }

        const totalHits = g.atkSpeed;

        // Total damage for this second
        const baseDamage = totalHits * totalAttackPower;

        // effective defense = def - penetration

        const effectiveDef = Math.max(0,target.defPerUnit - g.penPerUnit);

        // final reduction
        const reduced = baseDamage * (1 - 0.005 * effectiveDef);


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
    const order = ["tank", "inf", "sni"];

    return army.groups
        .slice()
        .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
        .map(g => {
            const current = alive(g);
            const lost = g.lostLast || 0;

            // percentage of units alive
            const percent = g.units > 0 ? (current / g.units) * 100 : 0;

            return `
                <div class="status-entry">
                    <b>${g.type.toUpperCase()}</b> — Units: ${current}
                    ${lost !== 0 ? `<span style="color:red">(${lost})</span>` : ""}
                    <div class="hp-bar-wrapper">
                        <div class="hp-bar" style="width:${percent}%;"></div>
                    </div>
                </div>
            `;
        })
        .join("");
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

// ==========================
// ----- Skill Apply --------
// ==========================

function applySkill(prefix) {

    const percent = Number(document.getElementById(`${prefix}-skill-percent`).value);
    const freq = Number(document.getElementById(`${prefix}-skill-frequency`).value);

    if (!window.skills) window.skills = {};

    window.skills[prefix] = {
        type: "increase-dmg",
        percent,
        frequency: freq
    };

    alert(`${prefix === "a1" ? "Army 1" : "Army 2"}: Damage Increase skill applied!`);
}


// Event listeners
document.getElementById("start-btn").addEventListener("click", startSimulation);
document.getElementById("reset-btn").addEventListener("click", resetSimulation);
