// Test double for @stellar/stellar-sdk. Real @stellar/stellar-sdk pulls
// in uint8array-extras, which ships ESM-only and breaks Jest's default
// CJS transform — the exact same category of problem
// tests/__mocks__/firebase.config.js already works around for
// firebase-admin/auth (see that file's own comment). The DB-free suite
// this mock serves (tests/app.test.js) only needs app.js's require
// graph to load without throwing; it never calls a real Stellar
// function. utilities/stellar/client.js does construct `new
// Horizon.Server(...)` at module-load time, so Horizon.Server has to be
// a real constructible stub here, not just present as a name.
class FakeHorizonServer {
	friendbot() {
		return { call: async () => ({}) };
	}
	loadAccount() {
		return Promise.resolve({ balances: [] });
	}
	fetchBaseFee() {
		return Promise.resolve(100);
	}
	payments() {
		return { forAccount: () => ({ order: () => ({ limit: () => ({ call: async () => ({ records: [] }) }) }) }) };
	}
	transactions() {
		return { transaction: () => ({ call: async () => ({ memo: null }) }) };
	}
	submitTransaction() {
		return Promise.resolve({ hash: '', successful: false });
	}
}

// utilities/stellar/soroban.js constructs `new rpc.Server(...)` at
// module-load time too, same reasoning as Horizon.Server above.
class FakeRpcServer {
	getAccount() {
		return Promise.resolve({});
	}
	prepareTransaction(tx) {
		return Promise.resolve(tx);
	}
	sendTransaction() {
		return Promise.resolve({ status: 'PENDING', hash: '' });
	}
	getTransaction() {
		return Promise.resolve({ status: 'SUCCESS', returnValue: null });
	}
}

module.exports = {
	Horizon: { Server: FakeHorizonServer },
	rpc: { Server: FakeRpcServer },
	Networks: { PUBLIC: 'Public Global Stellar Network ; September 2015', TESTNET: 'Test SDF Network ; September 2015' },
	Keypair: {
		random: () => ({ publicKey: () => 'GFAKE', secret: () => 'SFAKE' }),
		fromSecret: () => ({ publicKey: () => 'GFAKE', secret: () => 'SFAKE' }),
	},
	TransactionBuilder: class {
		addOperation() {
			return this;
		}
		addMemo() {
			return this;
		}
		setTimeout() {
			return this;
		}
		build() {
			return { sign: () => {} };
		}
	},
	Operation: {
		payment: () => ({}),
		changeTrust: () => ({}),
		setOptions: () => ({}),
		invokeContractFunction: () => ({}),
		uploadContractWasm: () => ({}),
		createCustomContract: () => ({}),
		createStellarAssetContract: () => ({}),
	},
	Asset: class {
		static native() {
			return { code: 'XLM' };
		}
		contractId() {
			return 'CFAKE';
		}
	},
	Address: class {
		constructor(addr) {
			this.addr = addr;
		}
	},
	Memo: { text: (t) => t },
	nativeToScVal: (v) => v,
	scValToNative: (v) => v,
	BASE_FEE: '100',
};
