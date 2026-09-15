#![cfg(test)]
use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    Env,
};

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (Address, token::StellarAssetClient<'a>, token::Client<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let address = sac.address();
    (
        address.clone(),
        token::StellarAssetClient::new(env, &address),
        token::Client::new(env, &address),
    )
}

#[test]
fn full_subscription_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let school = Address::generate(&env);
    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (token_address, token_admin, token_client) = create_token_contract(&env, &admin);

    // Give the school some USDC-shaped test tokens to pay with.
    token_admin.mint(&school, &1_000_000_000);

    let contract_id = env.register(SubscriptionBilling, ());
    let client = SubscriptionBillingClient::new(&env, &contract_id);

    let plan = symbol_short!("standard");
    let amount: i128 = 350_000_000; // 35.0000000 USDC (7 decimals)
    let period_seconds: u64 = 30 * 24 * 60 * 60; // 30 days

    let id = client.create_subscription(
        &school,
        &treasury,
        &token_address,
        &amount,
        &period_seconds,
        &plan,
    );

    // Nothing paid yet — must not read as current.
    assert_eq!(client.is_current(&id), false);

    let next_due = client.pay(&id);
    assert_eq!(next_due, env.ledger().timestamp() + period_seconds);
    assert_eq!(client.is_current(&id), true);

    // The actual token balances really moved — this is a real transfer,
    // not just a status flag.
    assert_eq!(token_client.balance(&treasury), amount);
    assert_eq!(token_client.balance(&school), 1_000_000_000 - amount);

    // Fast-forward past the billing period without paying again.
    env.ledger().with_mut(|li| {
        li.timestamp += period_seconds + 1;
    });
    assert_eq!(client.is_current(&id), false);

    // Pay again — a second real installment.
    client.pay(&id);
    assert_eq!(client.is_current(&id), true);
    assert_eq!(token_client.balance(&treasury), amount * 2);

    // Cancel — is_current must never read true again, even before the
    // current period would otherwise have lapsed.
    client.cancel(&id);
    assert_eq!(client.get_subscription(&id).active, false);
    assert_eq!(client.is_current(&id), false);
}

#[test]
#[should_panic(expected = "subscription is not active")]
fn cannot_pay_a_canceled_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let school = Address::generate(&env);
    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (token_address, token_admin, _token_client) = create_token_contract(&env, &admin);
    token_admin.mint(&school, &1_000_000_000);

    let contract_id = env.register(SubscriptionBilling, ());
    let client = SubscriptionBillingClient::new(&env, &contract_id);

    let id = client.create_subscription(
        &school,
        &treasury,
        &token_address,
        &100_000_000,
        &2_592_000,
        &symbol_short!("starter"),
    );

    client.cancel(&id);
    client.pay(&id); // must panic
}
