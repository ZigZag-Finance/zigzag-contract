#!/bin/bash

LOG_FILE=test.log

echo "Restart nodeos"
(
  killall nodeos
  nodeos -e -p eosio \
    --plugin eosio::producer_plugin \
    --plugin eosio::history_api_plugin \
    --plugin eosio::chain_api_plugin \
    --plugin eosio::http_plugin \
    --plugin eosio::history_plugin \
    --access-control-allow-origin='*' \
    --delete-all-blocks \
    --hard-replay-blockchain \
    --contracts-console \
    --http-validate-host=false \
    --verbose-http-errors \
    --filter-on='*'
) >> nodeos.log 2>&1 &

disown -h
sleep 1

echo "Unlock wallet"
(
  key=`cat ./scripts/wallet-key.txt`
  cleos wallet open
  cleos wallet unlock --password $key
) >> $LOG_FILE 2>&1

echo "Create accounts"
(
  # Create actor accounts
  cleos create account eosio actor.alice EOS5FAoZCRvVSmScYZ4kr3kKCsjFccMLAq76jnMUWbMkJKwRfgs1j -p eosio@active &
  cleos create account eosio actor.bob EOS79bsXpwCph6BphUih6WvLy2sxpQcWKoYCk4JiCLTa1QYxY4aps -p eosio@active &
  cleos create account eosio actor.managr EOS574KQnrsDNXqrPy8whDyHBhyrDCQuVzxdLjHi7yopRHiDeSgSk -p eosio@active &
  cleos create account eosio actor.cron EOS5113PTx9kCNkMvPyQSeqtVW6e278tuNGWhtafEK4YMCTLkmkjy -p eosio@active &
  # Create liquidate accounts
  cleos create account eosio liquid.addr EOS6Xy4LE6QQGrAKxUFDh5byEZrxgKz14Mpe8qnz2xPxPVZjwsecn -p eosio@active &
  # Create oracle accounts
  cleos create account eosio oracle.1 EOS6Y94s7iDxc3o3FZBsmP9EWoEPrdGdTi4eGuLHPdhJBvLFbrKXZ -p eosio@active &
  cleos create account eosio oracle.2 EOS5ynygWf6RgE3pjfppK9Z4D59xnEGjwLVyhGr5vjZMZpqqB4wqm -p eosio@active &
  cleos create account eosio oracle.3 EOS6r6N6gmfm8UcF9zuMivVro5NaFQB2z2B1TG7DLPv9gbEhNSWBP -p eosio@active &
  # Create EOS token account
  cleos create account eosio eosio.token EOS7JiP5mBvq7UWJCGzeGPsiR2Bb1tStgRxHCzEk636HxKyLzYj1j -p eosio@active &
  # Create BOS token account
  cleos create account eosio bosio.token EOS5c5WJADXmwzbvBhTs8BrLwYtmopGHF8iWfKiaGM8MwA41T4H9h -p eosio@active &
  # Create ZIG token account
  cleos create account eosio zigtokenhome EOS8Niq2TpkpvrtXx2UUAJgTfaw3zgJr7A9PtAzrcLVBghNnXcPNc -p eosio@active &
  # Create smart contract account
  cleos create account eosio zigzag EOS7cwDd4bhNRVYWDB1HV93UoAK2KEUQYmkLwrm589CqUrght1chy -p eosio@active &
  wait && sleep 1
) >> $LOG_FILE 2>&1

echo "Publish token contracts"
(
  cleos set contract eosio.token ./config/eosio.contracts/eosio.token --abi eosio.token.abi -p eosio.token@active &
  cleos set contract zigtokenhome ./config/eosio.contracts/eosio.token --abi eosio.token.abi -p zigtokenhome@active &
  cleos set contract bosio.token ./config/eosio.contracts/eosio.token --abi eosio.token.abi -p bosio.token@active &
  wait && sleep 1
) >> $LOG_FILE 2>&1

echo "Create and issue tokens"
(
  # Create tokens
  cleos push action eosio.token create '{"issuer":"eosio", "maximum_supply":"1000000000.0000 EOS"}' -p eosio.token@active &
  cleos push action zigtokenhome create '{"issuer":"zigtokenhome", "maximum_supply":"1000000000.0000 ZIG"}' -p zigtokenhome@active &
  cleos push action bosio.token create '{"issuer":"bosio.token", "maximum_supply":"1000000000.0000 BOS"}' -p bosio.token@active &
  wait && sleep 1

  # Issue some EOS and ZIG
  cleos push action eosio.token issue '["actor.alice", "100.0000 EOS", "Issue to Alice"]' -p eosio@active &
  cleos push action bosio.token issue '["actor.alice", "100.0000 BOS", "Issue to Alice"]' -p bosio.token@active &
  cleos push action eosio.token issue '["actor.bob", "100.0000 EOS", "Issue to Bob"]' -p eosio@active &
  cleos push action zigtokenhome issue '["zigzag", "1000000.0000 ZIG", "ZIG issue"]' -p zigtokenhome@active &
  cleos push action zigtokenhome issue '["actor.bob", "100.0000 ZIG", "Issue ZIG to Bob"]' -p zigtokenhome@active &
  wait && sleep 1
) >> $LOG_FILE 2>&1

echo "Publish project"
(
  cleos set contract zigzag build zigzag.wasm zigzag.abi -p zigzag@active
  cleos set account permission zigzag active --add-code
) >> $LOG_FILE 2>&1

echo "Setup initial contract state"
(
  cleos push action zigzag setparam '["max.oracles", "10"]' -p zigzag@active &
  cleos push action zigzag setparam '["position.def", "1.5"]' -p zigzag@active &
  cleos push action zigzag setparam '["interest.def", "0.001"]' -p zigzag@active &
  cleos push action zigzag setparam '["interest.int", "86400"]' -p zigzag@active &
  cleos push action zigzag setparam '["liquidate.th", "1.4"]' -p zigzag@active &
  cleos push action zigzag setparam '["penalty", "0.15"]' -p zigzag@active &
  cleos push action zigzag setparam '["manager", "actor.managr"]' -p zigzag@active &
  cleos push action zigzag setparam '["cron.account", "actor.cron"]' -p zigzag@active &
  cleos push action zigzag setparam '["liquid.addr", "liquid.addr"]' -p zigzag@active &

  cleos push action zigzag addcollater '["4,EOS", "eosio.token"]' -p zigzag@active &
  wait && sleep 1
  cleos push action zigzag setcollater '["4,EOS", true]' -p zigzag@active &

  cleos push action zigzag addoracle '["oracle.1", ["4,EOS"]]' -p zigzag@active &
  cleos push action zigzag addoracle '["oracle.2", ["4,EOS"]]' -p zigzag@active &
  cleos push action zigzag addoracle '["oracle.3", ["4,EOS"]]' -p zigzag@active &
  wait && sleep 1

  cleos push action zigzag setrate '["oracle.2", "4,EOS", "4"]' -p oracle.2@active &
  cleos push action zigzag setrate '["oracle.3", "4,EOS", "8"]' -p oracle.3@active &
  wait && sleep 1
) >> $LOG_FILE 2>&1

echo "Node setup finished"
