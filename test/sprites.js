const fs = require("fs");
const vm = require("vm");
const path = require("path");
const JS = path.join(__dirname, "..", "js");

const sb = { console };
sb.window = sb;
sb.document = { createElement: () => ({ getContext: () => ({ fillRect() {} }), width: 0, height: 0 }) };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(JS, "sprites.js"), "utf8"), sb);

const S = sb.window.NEX.SPRITES;
let bad = 0;
for (const [name, def] of Object.entries(S)) {
  const w = def.rows[0].length;
  def.rows.forEach((r, i) => {
    if (r.length !== w) {
      bad++;
      console.log(name + " row " + i + " len " + r.length + " expected " + w + " " + JSON.stringify(r));
    }
    for (const ch of r) {
      if (ch !== "." && !def.pal[ch]) {
        bad++;
        console.log(name + " row " + i + " unknown char " + ch);
      }
    }
  });
  console.log(name.padEnd(12) + " " + w + "x" + def.rows.length);
}
console.log(bad ? "\n" + bad + " probleme(s)" : "\nTous les sprites sont coherents.");
process.exit(bad ? 1 : 0);
