import * as fs from 'fs';
import * as Eos from 'eosjs';
import Big from 'big.js';
import { execFile } from 'child_process';

import { EosCurrency } from './helpers/currency.helper';
import { ACTOR, CONTRACT } from './constants';
import {
  EosAccount,
  PERMISSION_ACTIVE,
  PERMISSION_OWNER,
  EosPermission,
} from './helpers/account.helper';

export { DecimalString } from 'eosjs/lib/format';

const config = {
  chainId: 'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f',
  httpEndpoint: 'http://localhost:8888',
  expireInSeconds: 60,
  broadcast: true,
  verbose: false,
  sign: true,
};
let eos_object: Eos;

export function eos() {
  if (!eos_object) {
    eos_object = Eos(config);
  }

  return eos_object;
}

export async function getBlockNum() {
  return (await eos().getInfo({})).head_block_num;
}

export async function getAccountBalance(
  contract: string,
  account: string,
  symbol: string,
): Promise<string> {
  const balances = await eos().getCurrencyBalance(contract, account, symbol);

  let result = Big(0);

  for (const balance of balances) {
    const match = /([\d\.]+)\s[A-Z]{1,7}/.exec(balance);
    if (match && match[1]) {
      result = result.plus(match[1]);
    }
  }
  return result.toFixed();
}

function parseExceptionAssertion(exception: any) {
  if (!exception) {
    return;
  }
  try {
    if (typeof exception === 'string') {
      exception = JSON.parse(exception);
    }
    return exception.error.details
      .filter(e => e.method === 'eosio_assert' || e.method === 'require_authorization')
      .map(e => {
        const msg = e.message.replace(/assertion failure with message: /, '');
        return msg;
      })
      .shift();
  } catch (e) {
    return;
  }
}

export async function expectException(
  method: string,
  data: any,
  actor: EosAccount,
  assertion?: string,
  contractName: string = ACTOR.CONTRACT.name,
) {
  let exception: any;
  try {
    await simpleAction(contractName, method, data, actor);
  } catch (e) {
    exception = e;
  }
  expect(exception).toBeDefined();
  if (typeof exception !== 'object') {
    exception = JSON.parse(exception);
  }
  if (exception instanceof Error) {
    if (assertion) {
      expect(exception.message).toContain(assertion);
    }
  } else {
    expect(exception.code).toEqual(500);
    if (assertion) {
      expect(exception.error.details).toBeDefined();
      expect(parseExceptionAssertion(exception)).toEqual(assertion);
    }
  }
}

export async function expectSuccess(
  method: string,
  data: any,
  actor: EosAccount,
  contractName: string = ACTOR.CONTRACT.name,
) {
  let exception: any;
  try {
    await simpleAction(contractName, method, data, actor);
  } catch (e) {
    exception = e;
  }
  expect(parseExceptionAssertion(exception)).toBeUndefined();
  expect(exception).toBeUndefined();
}

export async function getById(
  table: string,
  id: string,
  scope: string = ACTOR.CONTRACT.name,
): Promise<any> {
  const params = {
    json: true,
    code: ACTOR.CONTRACT.name,
    scope: scope,
    table: table,
    table_key: 'primary_key',
    limit: 1,
  };
  params['lower_bound'] = id;
  params['upper_bound'] = Big(id)
    .plus(1)
    .toFixed();
  const result = await eos().getTableRows(params);
  if (!result || !result.rows || result.rows.length == 0) {
    return undefined;
  }
  return result.rows[0];
}

export async function listTable(
  table: string,
  scope: string = ACTOR.CONTRACT.name,
): Promise<any> {
  const result = await eos().getTableRows({
    json: true,
    code: ACTOR.CONTRACT.name,
    scope: scope,
    table: table,
    limit: 100,
  });
  console.log(result.rows);
}

export function stringToName(str: string): string {
  return Eos.modules.format.encodeName(str, false);
}

export async function createAccount(account: EosAccount) {
  await eos().transaction(tr => {
    tr.newaccount({
      creator: ACTOR.SYSTEM.name,
      name: account.name,
      owner: account.publicKey(PERMISSION_OWNER),
      active: account.publicKey(PERMISSION_ACTIVE),
    });
  }, ACTOR.SYSTEM.options());
  if (account.withCodeAccess) {
    await createCustomPermission(
      account,
      account.permissionByName(PERMISSION_ACTIVE)!,
    );
  }
  account.permissions.forEach(async permission => {
    if (
      permission.name !== PERMISSION_ACTIVE &&
      permission.name !== PERMISSION_OWNER
    ) {
      await createCustomPermission(account, permission);
    }
  });
}

export async function createCustomPermission(
  account: EosAccount,
  permission: EosPermission,
) {
  console.log(
    `Account ${account.name}, permission ${permission.name} creating`,
  );

  const params = {
    account: account.name,
    permission: permission.name,
    parent: PERMISSION_OWNER,
    auth: {
      threshold: 1,
      keys: [
        {
          key: account.publicKey(permission.name),
          weight: 1,
        },
      ],
    },
  } as any;
  if (permission.name === PERMISSION_ACTIVE) {
    params.auth.accounts = [
      {
        permission: { actor: ACTOR.CONTRACT.name, permission: 'eosio.code' },
        weight: 1,
      },
    ];
  }

  await eos().transaction(tr => {
    tr.updateauth(params, account.options(PERMISSION_OWNER));
  }, account.options());

  account.links.forEach(async link => {
    if (link.permission === permission.name) {
      // Also create a link
      await eos().transaction(tr => {
        tr.linkauth(
          {
            account: account.name,
            code: ACTOR.CONTRACT.name,
            type: link.method,
            requirement: link.permission,
          },
          account.options(PERMISSION_OWNER),
        );
      }, account.options());
    }
  });
}

async function createToken(currency: EosCurrency) {
  expect(currency.account).toBeDefined();
  const contract = await eos().contract(currency.account!.name);
  await contract.create(
    {
      issuer: currency.account!.name,
      maximum_supply: currency.formatSupply(),
    },
    currency.account!.options(),
  );
}

async function issueToken(currency: EosCurrency) {
  expect(currency.account).toBeDefined();
  const contract = await eos().contract(currency.account!.name);
  await contract.issue(
    {
      to: ACTOR.CONTRACT.name,
      quantity: currency.formatSupply(),
      memo: 'Initial issue',
    },
    currency.account!.options(),
  );
}

export async function createAndIssueCurrency(currency: EosCurrency) {
  expect(currency.account).toBeDefined();
  try {
    const wasm = fs.readFileSync(
      `./config/eosio.contracts/eosio.token/eosio.token.wasm`,
    );
    const abi = fs.readFileSync(
      `./config/eosio.contracts/eosio.token/eosio.token.abi`,
    );

    try {
      //console.log(`Setting code for: ${currency.account!.name} account`);
      await eos().setcode(
        currency.account!.name,
        0,
        0,
        wasm,
        currency.account!.options(),
      );
    } catch (e) {}
    try {
      //console.log(`Setting abi for: ${currency.account!.name} account`);
      await eos().setabi(
        currency.account!.name,
        JSON.parse(abi.toString()),
        currency.account!.options(),
      );
    } catch (e) {}
    await createToken(currency);
    await issueToken(currency);
  } catch (e) {
    console.log(e);
  }
}

export async function setRate(
  oracle: EosAccount,
  symbol: EosCurrency,
  rate: number,
) {
  const contract = await eos().contract(ACTOR.CONTRACT.name);
  await contract.setrate(
    {
      oracle: oracle.name,
      collateral: symbol.toString(),
      rate: rate,
    },
    oracle.options(),
  );
}

export async function checkCurrencies(currencies: EosCurrency[]) {
  currencies.forEach(async currency => {});
}

export function getUnixTime() {
  return Math.floor(Date.now() / 1000);
}

export async function sleep(millis: number) {
  return new Promise(resolve =>
    setTimeout(() => {
      resolve();
    }, millis),
  );
}

export async function simpleTransaction(actions: any[], actor: EosAccount) {
  return await eos().transaction(
    {
      actions: actions.map(act => {
        act.authorization = actor.authorization();
        return act;
      }),
    },
    { keyProvider: actor.keyProvider() },
  );
}

export async function simpleAction(
  account: string,
  action: string,
  data: any,
  actor: EosAccount,
) {
  return await simpleTransaction(
    [
      {
        account,
        name: action,
        data,
      },
    ],
    actor,
  );
}

export async function transfer(
  contract: string,
  from: EosAccount,
  to: string | EosAccount,
  quantity: string,
  memo: string = '',
) {
  return await simpleAction(
    contract,
    'transfer',
    {
      from: from.name,
      to: typeof to === 'object' ? to.name : to,
      quantity,
      memo,
    },
    from,
  );
}

export async function cleos(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('cleos', args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      resolve(stdout);
    });
  });
}

export async function cleosGetActions(
  account: string,
  opts?: { compact?: boolean; pos?: number; offset?: number },
) {
  const args = ['get', 'actions', '--json', account];
  if (opts && opts.pos !== undefined) {
    args.push(opts.pos.toString());
  }
  if (opts && opts.offset !== undefined) {
    args.push(opts.offset.toString());
  }
  const output = await cleos(args);
  const data = JSON.parse(output);
  if (opts && opts.compact) {
    return data.actions.map(a => a.action_trace.act);
  } else {
    return data;
  }
}
