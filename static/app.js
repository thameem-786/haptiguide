const $ = id => document.getElementById(id);
const on = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };

const toast = $("toast");
let toastTimer;
function notify(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function updateClock() {
  const now = new Date();
  if ($("dateText")) $("dateText").textContent = now.toLocaleDateString("en-US", {weekday:"short", day:"2-digit", month:"short", year:"numeric"});
  if ($("timeText")) $("timeText").textContent = now.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"});
}
updateClock();
setInterval(updateClock, 30000);

let connected = false;
let navigating = false;
let hapticsOn = true;
let zoom = 1;
let currentDestination = ($("destinationSelect") && $("destinationSelect").value) || "e204";

function setMapStatus(text) {
  const el = $("mapStatus");
  if (!el) return;
  const dot = document.createElement("i");
  dot.className = "tiny-dot";
  el.replaceChildren(dot, " " + text);
}

/* ======================================================================
 * ROUTING  (shortest path on the real floor-plan pixels)
 * ----------------------------------------------------------------------
 * The old version used a hand-traced node graph. Its Faculty Room (E205)
 * route went up to the north corridor, left, down, then diagonally through
 * the wall, which is both longer and wrong. The graph is gone.
 *
 * Instead, a walkability grid was generated from floorplan.png itself:
 *   - walls, pillars and the courtyard lawn are blocked,
 *   - door openings, corridors and room interiors are free,
 *   - walls are inflated by ~9 px so the path keeps clear of them.
 * Theta* (any-angle A*) then finds the true shortest path through free
 * space, so a route can never cross a wall and always uses the nearest door.
 *
 * Coordinates are in the floor-plan image's 1536 x 1024 pixel system.
 * GRID_B64 is a bit-packed 384 x 256 grid, one cell = 4 px, row-major,
 * 1 = walkable. If you edit floorplan.png, regenerate it.
 * ====================================================================== */
// <ROUTING>
const CELL = 4, GW = 384, GH = 256;
const START = [420, 640];              // "Your Position" (corridor outside Classroom E206)
const PX_PER_METER = 36;               // ASSUMPTION: ~1 m door = ~36 px. Calibrate to your building.
const WALK_SPEED_MPS = 0.8;            // comfortable assistive-walking speed
const GRID_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//gAAAAAH///AAAAAAAH///AAAAAAAAAD//8AAAAH///+AAAAAAA/+AAAAAAAAAP//gAAAAAH///AAAAAAAH///AAAAAAAAAB//8AAAAH///+AAAAAAA/+AAAAAAAAAP//gAAAAAH///AAAAAAAH///AAAAAAAAAA//8AAAAH///+AAAAAAA/+AAAAAAAAAf//wAAAAAH///AAAAAAAH///AAAAAAAAAA//8AAAAH////AAAAAAB/+AAAAAAAAAf//wAAAAAP///gAAAAAAP///gAAAAAAAAA//+AAAAP////AAAAAAB//AAAAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////4Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4AP//////gAAAAB/////8Af//////////8Af////////////8A//////////////4Af//////gAAAAB/////8Af//////////8Af////////////8A//////////////4Af//////gAAAAB/////8Af//////////8Af////////////8A//////////////4A///////gAAAAB/////8Af//////////8Af////////////8A//////////////4A///////gAAAAB/////8Af//////////8Af////////////8A//////////////4A///////gAAAAB/////8Af//////////8Af////////////8A//////////////4A///////gAAAAH/////8Af//////////8Af////////////8A//////////////4Af//////wAAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8Af//////////8Af////////////8A//////////////4AP///////AAAA//////8AAP/gAAAAAAf8AD/gAAAAAAAAA/4AP+AAAAAAAAAAAAAAP///////AAAA//////8AAD+AAAAAAAP4AB/AAAAAAAAAAfwAH8AAAAAAAAAAAAAAP//////gAAAAD/////4AAD+AAAAAAAP4AB/AAAAAAAAAAfgAH8AAAAAAAAAAAAAAP8AAAAAAAAAAB/////4AAB+AAAAAAAP4AB/AAAAAAAAAAfgAH8AAAAAAAAAAAAAAPwAAAAAAAAAAB/////4AAB+AAAAAAAP4AB/AAAAAAAAAAfgAH8AAAAAAAAAAAAAAPwAAAAAAAAAAB/////4AAB+AAAAAAAP4AB/AAAAAAAAAAfgAH8AAAAAAAAAAAAAAPwAAAAAAAAAAB/////8AAD+AAAAAAAP4AB/AAAAAAAAAAfwAH8AAAAAAAAAAAAAAfwAAAAAAAAAAB/////8AAD+AAAAAAAP4AB/AAAAAAAAAAfwAH8AAAAAAAAAAAAAAfwAAAAAAAAAAB//////AAP/gAAAAAA/+AH/wAAAAAAAAB/8Af/AAAAAAAAAAAAAB/wAAAAAAAAAAB//////////////////////////////////////////////4B////4AAAAAAAAAAB//////////////////////////////////////////////8D//////////gAAAAB//////////////////////////////////////////////////////////gAAAAB//////////////////////////////////////////////////////////gAAAAB//////////////////////////////////////////////////////////gAAAAB//////////////////////////////////////////////////////////gAAAAB//////////////////////////////////////////////////////////gAAAAB//////////////////////////////////////////////////////////gAAAAB//////////////////////////////////////////////+D//////////gAAAAB//////////////8H//////////////////////////gP//8B//////////gAAAAAAAAAAAAAAAAf//wB//////////////////////////AH//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAf//wB//////////////////////////AD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP//gA//////////////////////////AD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP//gA//////////////////////////AD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP//gB4AAAAAAAAAAAP4AAAAAAAAAAAHAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP//gBwAAAAAAAAAAAHwAAAAAAAAAAAHAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP//gAwAAAAAAAAAAAHwAAAAAAAAAAADAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAf//wBwAAAAAAAAAAAHwAAAAAAAAAAADAH//4AAAAAAAAAAAAAAAAD//////////Af//wBwAAAAAAAAAAAHwAAAAAAAAAAADAH//4B//////////gAAAA/////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B//////////5AAAA/////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA/////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA/////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA/////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA/////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA///////////x/////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA///////////Af////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA///////////Af////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAAAAPwAAAAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B///////////AAAA//////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B///////////AAAAD/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B//////////wAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B//////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B//////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B//////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B//////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B//////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////8B//////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////////////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////////////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////////////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////////////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////////////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////////////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////////////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////8B//////////gAAAAB/////////+AP////wAAAAAAAAB/////8AAAAAAAAAD////4B//////////gAAAAAAAAAAAAAAAAP////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAf////wAAAAAAAAB/////8AAAAAAAAAD////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAf////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAB///wB/////x/////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAB///wB///////////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAB///wB///////////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAB///wB///////////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAB///wB///////////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAB///wB///////////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAB///wB///////////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAAD///wB/////gf////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAA////wB/////Af////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////gAAAA////wB/////AP////wAAAAAAAAB/////8AAAAAAAAAD////4B/+AP//////5AAAA////wB/////AP////wAAAAAAAAAAAP4AAAAAAAAAAAD////4B/+AP///////AAAA////wB/////AP////wAAAAAAAAAAAHwAAAAAAAAAAAD////8D//Af///////AAAA////wAAAAAAAP////wAAAAAAAAAAAHwAAAAAAAAAAAD////////Af///////AAAA////wAAAAAAAP////wAAAAAAAAAAAHwAAAAAAAAAAAD/////////////////AAAA////wAAAAAAAP////wAAAAAAAAAAAHwAAAAAAAAAAAD/////////////////AAAA////wAAAAAAAP////wAAAAAAAAAAAHwAAAAAAAAAAAD////+P///////////AAAA////wAAAAAAAP////wAAAAAAAAAAAHwAAAAAAAAAAAD////8D///////////AAAA////wAAAAAAAP////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B///////////AAAA////4AAAAAAAP////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B//x////////AAAA////4AAAAAAAf////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B//Af///////AAAA///////////gf////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B//Af///////AAAAD////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B/+AP///////AAAAB////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4B/+AP//////wAAAAB////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4AAAAP//////gAAAAB////////////////wAAAAAAAAAAAHwAAAAAAAAAAAD////4AAAAP//////gAAAAB//////////////4DwAAAAAAAAAAAHwAAAAAAAAAAADgP//4AAAAP//////gAAAAB//////////////wBwAAAAAAAAAAAHwAAAAAAAAAAADAH//4AAAAP//////gAAAAB//////////gf//gBwAAAAAAAAAAAHwAAAAAAAAAAADAD//4AAAAP//////gAAAAB//////////Af//gAwAAAAAAAAAAAHwAAAAAAAAAAAHAD//4AAAAP//////gAAAAB//////////AP//gA4AAAAAAAAAAAP4AAAAAAAAAAAPAD//4AAAAP//////gAAAAB//////////AP//gA//////////////////////////AD//8AAAAP//////gAAAAB//////////AP//gA//////////////////////////AD/////+AP//////gAAAAB//////////AP//gB//////////////////////////AD/////+AP//////gAAAAB//////////AP//wB//////////////////////////AH/////+AP//////gAAAAB//////////AP//wD//////////////////////////AH/////+AP//////gAAAAB//////////AP/////////////////////////////////////+AP//////gAAAAB//////////AP/////////////////////////////////////+AP//////gAAAAB//////////AP/////////////////////////////////////+AP//////gAAAAB//////////AP/////////////////////////////////////+AP//////gAAAAB//////////AP/////////////////////////////////////+AP//////gAAAAB/////+AAAAAP/////////////////////////////////////+AP//////gAAAAB/////8AAAAAA/4AAAAAAAAAB/gAAAAAAAAAAAAAH/AAAAAAAf4AAAAAAAAAAAAAB/////8AAAAAAfwAAAAAAAAAB/gAAAAAAAAAAAAAD+AAAAAAAP4AAAAAAAAAAAAAB/////8AAAAAAfwAAAAAAAAAA/AAAAAAAAAAAAAAD+AAAAAAAPwAAAAAAAAAAAAAB/////8AAAAAAfwAAAAAAAAAA/AAAAAAAAAAAAAAD+AAAAAAAPwAAAAAAAAAAAAAB/////8AAAAAAfwAAAAAAAAAA/AAAAAAAAAAAAAAD8AAAAAAAPwAAAAAAAAAAAAAB/////8AAAAAAfwAAAAAAAAAA/AAAAAAAAAAAAAAD8AAAAAAAPwAAAAAAAAAAAAAB/////8AAAAAAfwAAAAAAAAAB/AAAAAAAAAAAAAAD+AAAAAAAP4AAAAAAAAAAAAAD/////8AAAAAAf4AAAAAAAAAB/gAAAAAAAAAAAAAH+AAAAAAAP4AAAAAAAAAAAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAA//////8Af//////////////AP/////////////8Af///////////////////AAAAD/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAB/////8Af//////////////AP/////////////8Af//////////////////gAAAAAAP//4AAAAAAP///4AAAAAAAAf//8AAAAAD///AAAAAP///gAAAAf///gAAAAAAAAAP//4AAAAAAP///wAAAAAAAAf//4AAAAAD///AAAAAP///AAAAAP///gAAAAAAAAAP//4AAAAAAP///wAAAAAAAAf//4AAAAAD///AAAAAP///AAAAAP///AAAAAAAAAAP//4AAAAAAP///wAAAAAAAAf//4AAAAAD///AAAAAP///AAAAAP///AAAAAAAAAAP//4AAAAAAP///wAAAAAAAAf//4AAAAAD///AAAAAP///AAAAAP///AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const grid = (() => {
  const bin = atob(GRID_B64);
  const cells = new Uint8Array(GW * GH);
  for (let i = 0; i < cells.length; i++) cells[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  return cells;
})();

const destinations = {
  e201:   {name:"Communication Lab (E201)", pt:[387,150]},
  e202:   {name:"VLSI Lab (E202)",          pt:[717,150]},
  e203:   {name:"Embedded Lab (E203)",      pt:[1085,150]},
  male:   {name:"Restroom (Male)",          pt:[1385,165]},
  e204:   {name:"Electronics Lab (E204)",   pt:[1357,395]},
  e205:   {name:"Faculty Room (E205)",      pt:[190,390]},
  lift:   {name:"Lift",                     pt:[250,525]},
  stairs1:{name:"Staircase (ST-1)",         pt:[135,110]},
  stairs2:{name:"Staircase (ST-2)",         pt:[135,760]},
  e206:   {name:"Classroom (E206)",         pt:[430,760]},
  e207:   {name:"Project Lab (E207)",       pt:[810,760]},
  e208:   {name:"Seminar Hall (E208)",      pt:[1230,760]},
  female: {name:"Restroom (Female)",        pt:[1385,560]},
  open:   {name:"Open Area",                pt:[766,460]}
};

const cellOf = p => [Math.min(GW-1, Math.max(0, Math.floor(p[0]/CELL))), Math.min(GH-1, Math.max(0, Math.floor(p[1]/CELL)))];
const isFree = (cx, cy) => cx >= 0 && cy >= 0 && cx < GW && cy < GH && grid[cy*GW + cx] === 1;

// Nearest walkable cell (BFS) so a marker placed on text/wall still resolves.
function snapToFree(p) {
  const [sx, sy] = cellOf(p);
  if (isFree(sx, sy)) return [sx, sy];
  const seen = new Set([sy*GW+sx]); let q = [[sx, sy]];
  while (q.length) {
    const nq = [];
    for (const [x, y] of q) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy, k = ny*GW+nx;
      if (nx<0||ny<0||nx>=GW||ny>=GH||seen.has(k)) continue;
      if (isFree(nx, ny)) return [nx, ny];
      seen.add(k); nq.push([nx, ny]);
    }
    q = nq;
  }
  return null;
}

// Straight line stays on free cells (samples every half cell, blocks corner cutting).
function lineOfSight(a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const steps = Math.ceil(Math.hypot(dx, dy) * 2);
  let px = a[0], py = a[1];
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i/steps : 0;
    const x = Math.floor(a[0] + dx*t + 0.5), y = Math.floor(a[1] + dy*t + 0.5);
    if (!isFree(x, y)) return false;
    if (x !== px && y !== py && (!isFree(x, py) || !isFree(px, y))) return false;
    px = x; py = y;
  }
  return true;
}

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item); let i = a.length-1;
    while (i > 0) { const p = (i-1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2*i+1, r = l+1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

// Theta*: A* where a node may take its parent's parent if there is line of sight.
function thetaStar(startCell, goalCell) {
  const key = c => c[1]*GW + c[0];
  const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
  const g = new Map([[key(startCell), 0]]), parent = new Map([[key(startCell), startCell]]);
  const cellAt = new Map([[key(startCell), startCell]]), closed = new Set();
  const heap = new MinHeap(); heap.push([dist(startCell, goalCell), startCell]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while (heap.size) {
    const cur = heap.pop()[1], ck = key(cur);
    if (closed.has(ck)) continue;
    if (ck === key(goalCell)) {
      const out = [cur]; let c = cur;
      while (key(c) !== key(startCell)) { c = parent.get(key(c)); out.push(c); }
      return out.reverse();
    }
    closed.add(ck);
    for (const [dx, dy] of dirs) {
      const nx = cur[0]+dx, ny = cur[1]+dy;
      if (!isFree(nx, ny)) continue;
      if (dx && dy && (!isFree(cur[0]+dx, cur[1]) || !isFree(cur[0], cur[1]+dy))) continue;
      const nb = [nx, ny], nk = key(nb);
      if (closed.has(nk)) continue;
      const par = parent.get(ck);
      let cand, via;
      if (lineOfSight(par, nb)) { via = par; cand = g.get(key(par)) + dist(par, nb); }
      else { via = cur; cand = g.get(ck) + dist(cur, nb); }
      if (cand < (g.get(nk) ?? Infinity)) {
        g.set(nk, cand); parent.set(nk, via); cellAt.set(nk, nb);
        heap.push([cand + dist(nb, goalCell), nb]);
      }
    }
  }
  return null;
}

const pxDist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const heading = (a, b) => (Math.atan2(b[0]-a[0], -(b[1]-a[1])) * 180/Math.PI + 360) % 360; // 0 = map north

// Drop near-collinear vertices so the drawn path and turn list stay clean.
function simplify(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const turn = Math.abs(((heading(out[out.length-1], points[i]) - heading(points[i], points[i+1]) + 540) % 360) - 180);
    if (turn > 6) out.push(points[i]);
  }
  out.push(points[points.length-1]);
  return out;
}

function astarRoute(destinationKey, from = START) {
  const d = destinations[destinationKey];
  if (!d) return null;
  const s = snapToFree(from), t = snapToFree(d.pt);
  if (!s || !t) return null;
  const cells = thetaStar(s, t);
  if (!cells) return null;
  const centre = c => [c[0]*CELL + CELL/2, c[1]*CELL + CELL/2];
  const dest = [t[0]*CELL + CELL/2, t[1]*CELL + CELL/2];
  let pts = cells.map(centre);
  pts[0] = from.slice();
  pts[pts.length-1] = (isFree(...cellOf(d.pt))) ? d.pt.slice() : dest;
  pts = simplify(pts);
  const length = pts.slice(1).reduce((sum, p, i) => sum + pxDist(pts[i], p), 0);
  return {points: pts, length, meters: length / PX_PER_METER, steps: buildSteps(pts)};
}

// Turn-by-turn: user is assumed to face the first leg.
function buildSteps(pts) {
  const steps = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const legM = pxDist(pts[i], pts[i+1]) / PX_PER_METER;
    let turn = null;
    if (i + 2 < pts.length) {
      const diff = ((heading(pts[i+1], pts[i+2]) - heading(pts[i], pts[i+1]) + 540) % 360) - 180;
      turn = Math.abs(diff) < 20 ? "straight" : diff > 0 ? "right" : "left";
    }
    steps.push({meters: legM, then: turn});
  }
  return steps;
}
// </ROUTING>

function pathD(points) { return points.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" "); }
function setRouteOverlay(result) {
  if ($("plannedRoute")) $("plannedRoute").setAttribute("d", result ? pathD(result.points) : "");
  if ($("alternateRoute")) $("alternateRoute").setAttribute("d", "");
  if ($("blockedRoute")) $("blockedRoute").setAttribute("d", "");
  const marker = $("destinationMarker");
  if (!marker) return;
  if (result) {
    const p = result.points[result.points.length - 1];
    marker.setAttribute("transform", `translate(${p[0]} ${p[1]})`);
    marker.style.display = "";
  } else marker.style.display = "none";
}
function setDestination(key, quiet = false) {
  if (!destinations[key]) return;
  currentDestination = key;
  const result = astarRoute(key);
  setRouteOverlay(result);
  const d = destinations[key];
  const instruction = $("nextInstruction"), turnIcon = $("turnIcon"), turnDistance = $("turnDistance");
  if (result) {
    const first = result.steps[0];
    const m = Math.max(1, Math.round(first.meters));
    const icons = {left:"↰", right:"↱", straight:"↑"};
    if (!first.then) {
      instruction.textContent = "Go Forward"; turnIcon.textContent = "↑"; turnDistance.textContent = `for ${m} m to destination`;
    } else if (first.then === "straight") {
      instruction.textContent = "Go Forward"; turnIcon.textContent = "↑"; turnDistance.textContent = `for ${m} m`;
    } else {
      instruction.textContent = "Turn " + (first.then === "left" ? "Left" : "Right");
      turnIcon.textContent = icons[first.then]; turnDistance.textContent = `in ${m} m`;
    }
    $("eta").textContent = `${Math.max(1, Math.ceil(result.meters / WALK_SPEED_MPS / 60))} min`;
    $("remainingDistance").textContent = `Distance Remaining: ${Math.round(result.meters)} m`;
    setMapStatus(`Shortest route calculated to ${d.name}`);
    if (!quiet) notify("Shortest route calculated: " + d.name);
  } else {
    instruction.textContent = "Route unavailable"; turnIcon.textContent = "!"; turnDistance.textContent = "No safe route";
    $("eta").textContent = "—";
    $("remainingDistance").textContent = "Distance Remaining: —";
    setMapStatus("No route to " + d.name);
    if (!quiet) notify("No route found to " + d.name + ".");
  }
}
on("destinationSelect", "change", e => setDestination(e.target.value));
document.querySelectorAll("#roomClickTargets [data-destination]").forEach(el => {
  el.addEventListener("click", () => {
    const key = el.dataset.destination;
    if ($("destinationSelect")) $("destinationSelect").value = key;
    setDestination(key);
  });
});
on("startNav", "click", () => {
  if (!connected) { notify("Device is disconnected. Connect the ESP32 before starting."); return; }
  if (!astarRoute(currentDestination)) { notify("Navigation cannot start: no route available."); return; }
  navigating = true;
  setMapStatus("Navigation active · shortest route shown (demo mode)");
  $("startNav").classList.add("is-running");
  notify("Navigation started. This is a mapped demo route, not live tracking.");
});
on("stopNav", "click", () => {
  navigating = false;
  if ($("startNav")) $("startNav").classList.remove("is-running");
  setMapStatus("Navigation stopped · route retained");
  notify("Navigation stopped.");
});

on("deviceToggle", "click", () => {
  notify(connected
    ? "ESP32 telemetry is being received from the real device."
    : "ESP32 is offline. Check Wi-Fi, SERVER_URL, and that Flask is running.");
});
on("hapticToggle", "change", e => {
  hapticsOn = e.target.checked;
  const t = $("haptiguideText");
  if (t && t.childNodes[0]) t.childNodes[0].textContent = hapticsOn ? "ON " : "OFF ";
  notify(hapticsOn ? "Haptic guidance enabled (display demo)." : "Haptic guidance disabled (display demo).");
});
on("floorSelect", "change", e => {
  setMapStatus("Current uploaded floor plan · " + e.target.value);
  notify("This uploaded floor plan is currently mapped for one floor only.");
});
function applyZoom() { if ($("floorMap")) $("floorMap").style.transform = `scale(${zoom})`; }
on("zoomIn", "click", () => { zoom = Math.min(1.5, +(zoom + .1).toFixed(2)); applyZoom(); });
on("zoomOut", "click", () => { zoom = Math.max(.8, +(zoom - .1).toFixed(2)); applyZoom(); });
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
  const page = button.dataset.page;
  const scrollTo = (sel, block) => { const el = document.querySelector(sel); if (el) el.scrollIntoView({behavior:"smooth", block}); };
  if (page === "Map & Navigation") scrollTo(".map-card", "start");
  else if (page === "Destination") { if ($("destinationSelect")) $("destinationSelect").focus(); }
  else if (page === "Live View") scrollTo(".camera-panel", "center");
  else if (page === "Device Status") scrollTo(".device-panel", "center");
  else if (page === "User Manual") scrollTo(".manual-panel", "center");
  else if (page === "Settings") notify("Settings panel is a future integration step.");
  else window.scrollTo({top:0, behavior:"smooth"});
}));
const manualContent = {
  "How to Wear HaptiGuide":"Wear the device securely with M1 on the left shoulder, M2 below the neck, M3 on the right shoulder, and M4 on the lower back. Confirm the labels before use.",
  "Understanding Vibrations":"M1 indicates left, M2 indicates forward, M3 indicates right, and M4 indicates the configured rear-side cue. M1+M3 signals an obstacle; M2+M4 signals stairs/attention; all four motors signal a critical blocked path.",
  "How to Select Destination":"Choose a destination from the dropdown and press Start Navigation. This prototype uses a sample route and does not track a real indoor position.",
  "Safety Guidelines":"This dashboard is a prototype, not a certified mobility aid. Do not rely on it as your sole means of navigation. Use a familiar route, a companion, and normal mobility aids while testing.",
  "FAQ":"The connected status, battery, GPS, camera detections, ETA and route are demonstration values. They are not live ESP32, camera or positioning data."
};
document.querySelectorAll("[data-manual]").forEach(button => button.addEventListener("click", () => {
  $("modalTitle").textContent = button.dataset.manual;
  $("modalBody").textContent = manualContent[button.dataset.manual] || "Manual information will be added in a future version.";
  $("manualModal").hidden = false;
}));
on("closeModal", "click", () => { $("manualModal").hidden = true; });
on("manualModal", "click", e => { if (e.target.id === "manualModal") e.currentTarget.hidden = true; });

// Calculate and draw the initial route once on load.
setDestination(currentDestination, true);

/* ---------------------------------------------------------------------
 * ESP32 telemetry polling (Flask GET /api/telemetry)
 * ------------------------------------------------------------------- */
function applyConnectionUI(isConnected) {
  const wasConnected = connected;
  connected = isConnected;
  if ($("headerConnection")) $("headerConnection").textContent = isConnected ? "Device Connected" : "Device Disconnected";
  if ($("headerDevice")) $("headerDevice").textContent = isConnected ? "ESP32 Online" : "ESP32 Offline";
  const toggle = $("deviceToggle");
  if (toggle) {
    toggle.textContent = isConnected ? "Connected" : "Disconnected";
    toggle.style.background = isConnected ? "#07813d" : "#c72c3d";
  }
  document.querySelectorAll(".status-dot").forEach(el => el.style.background = isConnected ? "#4bd45e" : "#ef4444");
  if ($("ledDot")) $("ledDot").style.background = isConnected ? "#13a34a" : "#e23b4b";
  if ($("ledText")) $("ledText").textContent = isConnected ? "Green (Connected)" : "Red (Disconnected)";
  if (!isConnected && $("obstacleMark")) $("obstacleMark").style.display = "none";
  if (wasConnected && !isConnected && navigating) {
    navigating = false;
    if ($("startNav")) $("startNav").classList.remove("is-running");
    notify("ESP32 disconnected. Navigation stopped.");
  }
}

let pollInFlight = false;
async function pollEsp32Telemetry() {
  if (pollInFlight) return;               // never stack requests on a slow network
  pollInFlight = true;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const response = await fetch("/api/telemetry", {cache: "no-store", signal: ctrl.signal});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    applyConnectionUI(Boolean(data.connected));

    if ($("wifiIp") && data.wifi_ip) $("wifiIp").textContent = data.wifi_ip;

    if (data.battery !== null && data.battery !== undefined && !Number.isNaN(Number(data.battery))) {
      const pct = Math.max(0, Math.min(100, Number(data.battery)));
      if ($("batteryText")) $("batteryText").textContent = pct + "%";
      if ($("batteryFill")) $("batteryFill").style.width = pct + "%";
    }

    if ($("obstacleMark")) $("obstacleMark").style.display = connected && data.obstacle ? "" : "none";
    if (!navigating) {
      if (!connected) setMapStatus("ESP32 offline · waiting for telemetry");
      else if (data.obstacle) setMapStatus("Obstacle reported by ESP32" + (data.distance_cm != null ? " · " + Number(data.distance_cm).toFixed(0) + " cm" : ""));
      else setMapStatus("ESP32 connected · live telemetry received");
    }

    const obstacleSmall = document.querySelector(".detected-list div:first-of-type small");
    if (obstacleSmall && connected) {
      obstacleSmall.textContent = data.obstacle
        ? (data.distance_cm != null ? "(" + (Number(data.distance_cm) / 100).toFixed(2) + " m)" : "Detected")
        : "Not Detected";
    }
  } catch (error) {
    applyConnectionUI(false);
  } finally {
    clearTimeout(timer);
    pollInFlight = false;
  }
}
pollEsp32Telemetry();
setInterval(pollEsp32Telemetry, 1500);
