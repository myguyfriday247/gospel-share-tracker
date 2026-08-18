import { parseCSVToObjects } from "@/lib/csv";
import { readFileSync } from "fs";

const rows = parseCSVToObjects(readFileSync("entries-completed.csv", "utf8"));
console.log(`parsed rows: ${rows.length}`);
console.log(`columns    : ${Object.keys(rows[0] ?? {}).join(", ")}\n`);

// exactly the rules validateEntryRow enforces
const problems: string[] = [];
const boolCols = ["church_invite","spiritual_conversation","story_share","gospel_presentation"];
const oddBooleans = new Map<string, number>();
let noEmail=0, noDate=0, badDate=0, noReached=0, badReached=0, noType=0, withEmoji=0, withNewline=0;

rows.forEach((r, i) => {
  const line = i + 2;
  if (!r.email) { noEmail++; problems.push(`row ${line}: missing email`); }
  if (!r.entry_date) { noDate++; problems.push(`row ${line}: missing entry_date`); }
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(r.entry_date)) { badDate++; problems.push(`row ${line}: entry_date "${r.entry_date}" is not YYYY-MM-DD`); }
  if (!r.number_reached) { noReached++; problems.push(`row ${line}: missing number_reached`); }
  else if (!/^\d+$/.test(r.number_reached)) { badReached++; problems.push(`row ${line}: number_reached "${r.number_reached}" not a whole number`); }

  for (const c of [...boolCols, "gospel_response"]) {
    const v = r[c];
    if (v !== "true" && v !== "false" && v !== "") oddBooleans.set(`${c}="${v}"`, (oddBooleans.get(`${c}="${v}"`) ?? 0) + 1);
  }
  if (!boolCols.some(c => r[c] === "true")) { noType++; problems.push(`row ${line}: no share type is "true" (has: ${boolCols.map(c=>`${c}=${r[c]||"∅"}`).join(" ")})`); }

  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(r.notes ?? "")) withEmoji++;
  if ((r.notes ?? "").includes("\n")) withNewline++;
});

console.log(`rows with emoji in notes    : ${withEmoji}`);
console.log(`rows with newline in notes  : ${withNewline}`);
console.log(`\nvalues that are not exactly "true"/"false":`);
if (oddBooleans.size === 0) console.log("  (none)");
else [...oddBooleans].sort((a,b)=>b[1]-a[1]).forEach(([k,n]) => console.log(`  ${n.toString().padStart(4)}x  ${k}`));

console.log(`\n--- would be REJECTED by the importer ---`);
console.log(`missing email ${noEmail} | missing/bad date ${noDate}/${badDate} | missing/bad reached ${noReached}/${badReached} | no share type ${noType}`);
console.log(`total rejected rows: ${new Set(problems.map(p=>p.split(":")[0])).size} of ${rows.length}`);
if (problems.length) {
  console.log(`\nfirst 15 problems:`);
  problems.slice(0,15).forEach(p => console.log("  " + p));
}
