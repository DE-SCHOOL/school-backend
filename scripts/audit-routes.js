const fs = require('fs');
const path = require('path');

// Finds every .get(/.post(/.patch(/.delete( call in every routes file and
// checks whether "protect" appears anywhere inside that call's balanced
// parens. Prints anything that doesn't have it — a real gap, or (per
// this repo's precedent) an intentionally public route worth a second
// look either way. Written after two real unauthenticated routes were
// found by hand in Stage 3/5 that an earlier, cruder line-window-based
// grep scan had missed.

function findRouteFiles(dir) {
	let results = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results = results.concat(findRouteFiles(full));
		} else if (entry.name.endsWith('.routes.js')) {
			results.push(full);
		}
	}
	return results;
}

function checkFile(file) {
	// Strip //-comments first — a comment explaining what an old,
	// now-fixed route used to look like (this file has several) contains
	// route-call-shaped text that would otherwise false-positive.
	const src = fs
		.readFileSync(file, 'utf8')
		.split('\n')
		.map((line) => line.replace(/\/\/.*$/, ''))
		.join('\n');
	const methodRegex = /\.(get|post|patch|delete)\(/g;
	let match;
	const findings = [];

	while ((match = methodRegex.exec(src))) {
		const start = match.index + match[0].length - 1; // position of the opening '('
		let depth = 0;
		let end = start;
		for (let i = start; i < src.length; i++) {
			if (src[i] === '(') depth++;
			if (src[i] === ')') {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		const body = src.slice(start, end + 1);
		if (!body.includes('protect')) {
			const line = src.slice(0, match.index).split('\n').length;
			findings.push({ line, method: match[1], body: body.replace(/\s+/g, ' ').slice(0, 120) });
		}
	}
	return findings;
}

const routesDir = path.join(__dirname, '..', 'routes');
let totalFindings = 0;

for (const file of findRouteFiles(routesDir)) {
	const findings = checkFile(file);
	if (findings.length) {
		console.log(`\n${path.relative(process.cwd(), file)}`);
		for (const f of findings) {
			console.log(`  line ${f.line} .${f.method}(: ${f.body}`);
			totalFindings++;
		}
	}
}

console.log(`\n${totalFindings} route(s) with no "protect" in their handler chain.`);
