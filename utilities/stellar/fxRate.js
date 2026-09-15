// XAF-per-USDC conversion used to fix an invoice's amountUsdc at
// creation time. THIS IS A PLACEHOLDER, not a live rate feed — exactly
// the same honesty call already made for Stage 4's plan pricing
// (school.controller.js's DEFAULT_MONTHLY_PRICE_XAF). A real deployment
// needs a real FX data source (an exchange API, or a fixed peg the
// business decides on) before real money moves through this; wiring
// one in is a contained, drop-in replacement for this one function —
// nothing else in the payment flow needs to change.
const PLACEHOLDER_XAF_PER_USDC = 610;

function xafToUsdc(amountXAF) {
	return Number((amountXAF / PLACEHOLDER_XAF_PER_USDC).toFixed(7)); // Stellar amounts: 7 decimal places
}

module.exports = { xafToUsdc, PLACEHOLDER_XAF_PER_USDC };
