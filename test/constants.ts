import { EosAccount } from './helpers/account.helper';
import { EosCurrency } from './helpers/currency.helper';

export function authOptions(accountName: string, wif: string) {
  return {
    authorization: [{
      actor: accountName,
      permission: 'active'
    }],
    keyProvider: wif
  };
}

export function overrideParams(params: any, field?: string, value?: any) {
  const newParams = JSON.parse(JSON.stringify(params));
  if (field !== undefined && value !== undefined) {
    newParams[field] = value;
  }
  return newParams;
}

export const CONTRACT = {
  EOS: 'eosio.token',
  BOS: 'bosio.token',
  ZIGZAG: 'zigtokenhome'
}

export const ACTOR = {
  NOBODY: new EosAccount('actor.alice').key('5KCiBECnmefVAijRp7TQ6ip3NXJV856eq2XvZMVA5LU2duRELgu'),
  ALICE: new EosAccount('actor.alice').key('5KCiBECnmefVAijRp7TQ6ip3NXJV856eq2XvZMVA5LU2duRELgu'),
  BOB: new EosAccount('actor.bob').key('5J3varSkGdQkHGNC46wfbiForhCYaw64fghiEQSSGn5AaK7Yz1A'),
  CONTRACT: new EosAccount('zigzag').key('5KisorbRXtcsvXw4Y7kUhgiJ1JEPmSewFEepj5vuWbDgZqHFAkG'),
  SYSTEM: new EosAccount('eosio').key('5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'),
  ORACLE_1: new EosAccount('oracle.1').key('5JBwECHSQeRDV2noHrcmqAaMJRGwFfZESzVKzwS2onfryfPAeno'),
  ORACLE_2: new EosAccount('oracle.2').key('5Hz98DnCfP4Rf17SkHwu1fNxuZ5dgRbgD2X2ZX15kJt4bdMSCuZ'),
  ORACLE_3: new EosAccount('oracle.3').key('5KfTfyq2jC2rGi5yCBbwNzGGBjQ72GZi9EBnswo3eNESp3wVpho'),
  FAKE: new EosAccount('fake'),
  MANAGER: new EosAccount('actor.managr').key('5K9ssCJ9SHgk9ywNC2rNBDkXyYvYs96hSgH8tGttLsTuWFin2LN'),
  CRON: new EosAccount('actor.cron').key('5JREgHjXyy2wW3QhCGkTsunfa5PanQNY5SeD1erqCFcn4HKJ3oJ'),
  LIQUIDATE: new EosAccount('liquid.addr').key('5JuXYKnMN8ae5NVWEX5CZJmxSt7qDXrN8ShGFwi9nP7V1T81jPc')
}

export const SYMBOL: { [s: string]: EosCurrency } = {
  EOS: new EosCurrency('EOS', 4),
  BOS: new EosCurrency('BOS', 4),
  ZIGZAG: new EosCurrency('ZIG', 4),
  NEW: new EosCurrency('NEWSYM', 8),
  NEW_SYMBOL_WRONG_RECISION: new EosCurrency('NEWSYM', 7),
  NOT_EXISTING: new EosCurrency('FAKE', 6),
}

export const PARAM = {
  MAX_ORACLES: 'max.oracles',
  POSITION_DEF: 'position.def',
  INTEREST_DEF: 'interest.def',
  INTEREST_INTERVAL: 'interest.int',
  LIQUIDATE_THRESHOLD: 'liquidate.th',
  PENALTY: 'penalty',
  MANAGER_ACCOUNT: 'manager',
  CRON_ACCOUNT: 'cron.account',
  LIQUIDATE_ADDRESS: 'liquid.addr'
}

export const TABLE = {
  PARAMS: 'params',
  COLLATERALS: 'collaterals',
  ORACLES: 'oracles',
  RATES: 'rates',
  POSITIONS: 'positions'
}
