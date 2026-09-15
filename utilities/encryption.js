const crypto = require('crypto');

// Generic AES-256-GCM at-rest encryption, first consumer being custodial
// Stellar secret seeds (utilities/stellar/walletService.js) — deliberately
// its own module, not folded into that file, since "encrypt this string
// and be able to decrypt it later" is a generic capability, not a
// Stellar-specific one, should this platform ever need to encrypt
// anything else at rest.
//
// Uses its own env var, STELLAR_KEY_ENCRYPTION_SECRET, deliberately
// separate from JWT_SECRET/JWT_SECRET_STUDENT/etc. — a leaked JWT
// signing secret and a leaked field-encryption key are different classes
// of incident with different blast radii, and this repo already
// establishes the "one secret per concern" pattern (see e.g.
// JWT_SECRET_PLATFORM vs JWT_SECRET_STUDENT).

function getKey() {
	const secret = process.env.STELLAR_KEY_ENCRYPTION_SECRET;
	if (!secret) {
		throw new Error(
			'STELLAR_KEY_ENCRYPTION_SECRET is not set — refusing to encrypt/decrypt custodial secrets without it'
		);
	}
	// Accepts the env var as-is and derives a 32-byte key from it via
	// SHA-256, rather than requiring the operator to hand-generate exactly
	// 32 raw bytes correctly encoded — one less way to misconfigure this.
	return crypto.createHash('sha256').update(secret).digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // standard/recommended IV length for GCM

function encrypt(plaintext) {
	const key = getKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	// iv, ciphertext, and authTag concatenated and base64-encoded into one
	// storable string, so callers/schemas only need a single String field.
	return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decrypt(encoded) {
	const key = getKey();
	const raw = Buffer.from(encoded, 'base64');
	const iv = raw.subarray(0, IV_LENGTH);
	const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
	const ciphertext = raw.subarray(IV_LENGTH + 16);

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
