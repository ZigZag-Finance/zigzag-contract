#!/bin/bash

key=`cat scripts/wallet-key.txt`
cleos wallet open
cleos wallet unlock --password $key
cleos wallet import --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
cleos wallet import --private-key 5KisorbRXtcsvXw4Y7kUhgiJ1JEPmSewFEepj5vuWbDgZqHFAkG # zigzag
cleos wallet import --private-key 5JRuwSykR5Dm2skarPFsmBffa3uq1uAqktL9JSfgmUM2y5f5tGN # eosio.token
cleos wallet import --private-key 5JcXZWGcbUTfcEQcSxaFDrxyskAT3hLssw4Fi2M2tw4i64Vduir # bosio.token
cleos wallet import --private-key 5JXP8ineyjZZGXp9VtmAoUaFMw98KVTmrAHeamAFnaTpjuuT2Jr # zigtokenhome
cleos wallet import --private-key 5KCiBECnmefVAijRp7TQ6ip3NXJV856eq2XvZMVA5LU2duRELgu # actor.alice
cleos wallet import --private-key 5J3varSkGdQkHGNC46wfbiForhCYaw64fghiEQSSGn5AaK7Yz1A # actor.bob
cleos wallet import --private-key 5K9ssCJ9SHgk9ywNC2rNBDkXyYvYs96hSgH8tGttLsTuWFin2LN # actor.managr
cleos wallet import --private-key 5JREgHjXyy2wW3QhCGkTsunfa5PanQNY5SeD1erqCFcn4HKJ3oJ # actor.cron
cleos wallet import --private-key 5JuXYKnMN8ae5NVWEX5CZJmxSt7qDXrN8ShGFwi9nP7V1T81jPc # liquid.addr
cleos wallet import --private-key 5JBwECHSQeRDV2noHrcmqAaMJRGwFfZESzVKzwS2onfryfPAeno # oracle.1
cleos wallet import --private-key 5Hz98DnCfP4Rf17SkHwu1fNxuZ5dgRbgD2X2ZX15kJt4bdMSCuZ # oracle.2
cleos wallet import --private-key 5KfTfyq2jC2rGi5yCBbwNzGGBjQ72GZi9EBnswo3eNESp3wVpho # oracle.3