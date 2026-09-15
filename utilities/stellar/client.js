const { Horizon, Networks } = require('@stellar/stellar-sdk');

// One place that knows which Stellar network this deployment talks to.
// STELLAR_NETWORK defaults to 'testnet' — deliberately, so a missing env
// var in a new environment fails safe (play money) rather than silently
// pointing at mainnet. Going live on mainnet is a real, deliberate,
// funded decision (see my-todo.md Stage 6's own custody/key-rotation
// note) — it should never happen by omission.
const NETWORK = process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

const HORIZON_URL =
	NETWORK === 'mainnet'
		? 'https://horizon.stellar.org'
		: 'https://horizon-testnet.stellar.org';

const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

const server = new Horizon.Server(HORIZON_URL);

module.exports = { server, NETWORK, NETWORK_PASSPHRASE, HORIZON_URL };
