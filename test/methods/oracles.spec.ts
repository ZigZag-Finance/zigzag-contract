import { createAccount, expectException, expectSuccess, stringToName, getById, createAndIssueCurrency } from "../test.utils";
import { EosAccount } from "../helpers/account.helper";
import { SYMBOL, ACTOR, overrideParams, TABLE, PARAM } from "../constants";
import { EosCurrency } from "../helpers/currency.helper";
import { setupNode } from "../setup";

describe('oracles', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

  const ADD_ORACLE = 'addoracle';
  const SET_ORACLE = 'setoracle';
  const DEL_ORACLE = 'deloracle';
  const SET_RATE = 'setrate';

  const ACCOUNT_ORACLE_NEW: EosAccount = new EosAccount('neworacle').key('5HzPK1wFqUt2KA9b4kSDZdgwu3GFgsnaKZBuUHPumJzEDfB5F9t');
  const ACCOUNT_CURRENCY_ORACLE_NEW: EosAccount = new EosAccount('neworaclecol').key('5JD6G7nvjNx36PPYpPmwbb6ybPHLNo3iB773sqxzifcypNsb72G');
  const CURRENCY_ORACLE_NEW: EosCurrency = new EosCurrency('ORTEST', 5).setAccount(ACCOUNT_CURRENCY_ORACLE_NEW).setSupply('1000000');

  const ACCOUNT_ORACLE_1: EosAccount = new EosAccount('neworacle1').key('5HqXu4M1h7dJ7ehU7m4Xj7VXDNDTcrFdJPL1tWoTv8evmcj1J9R');
  const ACCOUNT_ORACLE_2: EosAccount = new EosAccount('neworacle2').key('5JQwcJKpMx35vLpakbfFxEMB8rdzutrAV32QaXqKckzGwu4iiYH');

  beforeAll(async () => {
    await setupNode();

    await Promise.all([
      createAccount(ACCOUNT_ORACLE_NEW),
      createAccount(ACCOUNT_CURRENCY_ORACLE_NEW),
      createAccount(ACCOUNT_ORACLE_1),
      createAccount(ACCOUNT_ORACLE_2),
    ]);

    await createAndIssueCurrency(CURRENCY_ORACLE_NEW);

    await expectSuccess('addcollater', {
      symbol: CURRENCY_ORACLE_NEW.toString(),
      account: ACCOUNT_CURRENCY_ORACLE_NEW.name
    }, ACTOR.CONTRACT);
  });

  describe(ADD_ORACLE, () => {

    const data = {
      account: ACCOUNT_ORACLE_NEW.name,
      symbols: [
        CURRENCY_ORACLE_NEW.toString()
      ]
    }
    const unknownAccount = overrideParams(data, 'account', ACTOR.FAKE.name);
    const extraSymbol = overrideParams(data, 'symbols', [SYMBOL.EOS.toString(), SYMBOL.NEW.toString()]);

    it(`${ADD_ORACLE}: fail - signed by invalid account`, async () => {
      await expectException(ADD_ORACLE, data, ACTOR.NOBODY);
    });

    it(`${ADD_ORACLE}: fail - oracle account does not exist`, async () => {
      await expectException(ADD_ORACLE, unknownAccount, ACTOR.CONTRACT);
    });

    it(`${ADD_ORACLE}: fail - at lease one symbol from oracle supported list does not exist`, async () => {
      await expectException(ADD_ORACLE, extraSymbol, ACTOR.CONTRACT);
    });

    it(`${ADD_ORACLE}: success - oracle added`, async () => {
      const empty = await getById(TABLE.ORACLES, ACCOUNT_ORACLE_NEW.nameValue);
      expect(empty).toBeUndefined();

      await expectSuccess(ADD_ORACLE, data, ACTOR.CONTRACT);

      const result = await getById(TABLE.ORACLES, ACCOUNT_ORACLE_NEW.nameValue);
      expect(result).toBeDefined();
      expect(result.account).toEqual(data.account);
      expect(result.symbols).toEqual([CURRENCY_ORACLE_NEW.toString()]);
    });

    it(`${ADD_ORACLE}: fail - oracle with this account already added`, async () => {
      await expectException(ADD_ORACLE, data, ACTOR.CONTRACT);
    });

    it(`${ADD_ORACLE}: fail - more oracles than allowed added`, async () => {
      // Set limit for the number of oracles to 5
      await expectSuccess('setparam', {
        key: PARAM.MAX_ORACLES,
        value: '5'
      }, ACTOR.CONTRACT);

      await expectSuccess(ADD_ORACLE, overrideParams(data, 'account', ACCOUNT_ORACLE_1.name), ACTOR.CONTRACT);
      await expectException(ADD_ORACLE, overrideParams(data, 'account', ACCOUNT_ORACLE_2.name), ACTOR.CONTRACT);

      await expectSuccess('setparam', {
        key: PARAM.MAX_ORACLES,
        value: '10'
      }, ACTOR.CONTRACT);
    });

  });

  describe(SET_ORACLE, () => {

    const data = {
      account: ACCOUNT_ORACLE_NEW.name,
      symbols: [
        CURRENCY_ORACLE_NEW.toString(),
        SYMBOL.EOS.toString()
      ]
    }
    const oracleNotFound = overrideParams(data, 'account', ACTOR.NOBODY.name);
    const extraSymbol = overrideParams(data, 'symbols', [SYMBOL.EOS.toString(), SYMBOL.NEW.toString()]);

    it(`${SET_ORACLE}: fail - signed by invalid account`, async () => {
      await expectException(SET_ORACLE, data, ACTOR.NOBODY);
    });

    it(`${SET_ORACLE}: fail - oracle does not exist in our system`, async () => {
      await expectException(SET_ORACLE, oracleNotFound, ACTOR.CONTRACT);
    });

    it(`${SET_ORACLE}: fail - at lease one symbol from oracle supported list does not exist`, async () => {
      await expectException(SET_ORACLE, extraSymbol, ACTOR.CONTRACT);
    });

    it(`${SET_ORACLE}: success - oracle updated`, async () => {
      const before = await getById(TABLE.ORACLES, ACCOUNT_ORACLE_NEW.nameValue);
      expect(before).toBeDefined();
      expect(before.symbols).toEqual([CURRENCY_ORACLE_NEW.toString()]);

      await expectSuccess(SET_ORACLE, data, ACTOR.CONTRACT);

      const result = await getById(TABLE.ORACLES, ACCOUNT_ORACLE_NEW.nameValue);
      expect(result).toBeDefined();
      expect(result.symbols).toEqual([CURRENCY_ORACLE_NEW.toString(), SYMBOL.EOS.toString()]);
    });

  });

  describe(DEL_ORACLE, () => {

    const data = {
      account: ACCOUNT_ORACLE_NEW.name
    }
    const rateData = {
      oracle: ACCOUNT_ORACLE_NEW.name,
      collateral: SYMBOL.EOS.toString(),
      rate: 5.,
    };
    const oracleNotFound = overrideParams(data, 'account', ACTOR.NOBODY.name);

    it(`${DEL_ORACLE}: fail - signed by invalid account`, async () => {
      await expectException(DEL_ORACLE, data, ACTOR.NOBODY);
    });

    it(`${DEL_ORACLE}: fail - oracle does not exist in our system`, async () => {
      await expectException(DEL_ORACLE, oracleNotFound, ACTOR.CONTRACT);
    });

    it(`${DEL_ORACLE}: success - oracle deleted`, async () => {
      const oracle1 = ACCOUNT_ORACLE_NEW;
      const oracle2 = ACCOUNT_ORACLE_1;

      // Make sure that oracle1 exists
      {
        const before = await getById(
          TABLE.ORACLES,
          oracle1.nameValue,
        );
        expect(before).toBeDefined();
      }

      // Make sure that oracle2 exists
      {
        const before = await getById(
          TABLE.ORACLES,
          oracle2.nameValue,
        );
        expect(before).toBeDefined();
      }

      // Add a rate set by oracle1
      {
        await expectSuccess(SET_RATE, { oracle: oracle1.name, collateral: SYMBOL.EOS.toString(), rate: 1. }, oracle1);
        const result = await getById(
          TABLE.RATES,
          stringToName(data.account),
          SYMBOL.EOS.symbolName,
        );
        expect(result).toBeDefined();
      }

      // Add a rate set by oracle2
      {
        const data = {
          account: oracle2.name,
          symbols: [
            SYMBOL.EOS.toString()
          ]
        }
        await expectSuccess(SET_ORACLE, data, ACTOR.CONTRACT);

        await expectSuccess(SET_RATE, { oracle: oracle2.name, collateral: SYMBOL.EOS.toString(), rate: 1. }, oracle2);
        const result = await getById(
          TABLE.RATES,
          stringToName(oracle2.name),
          SYMBOL.EOS.symbolName,
        );
        expect(result).toBeDefined();
      }

      await expectSuccess(DEL_ORACLE, { account: oracle1.name }, ACTOR.CONTRACT);

      // Make sure that there's no record of an oracle
      {
        const empty = await getById(
          TABLE.ORACLES,
          oracle1.nameValue,
        );
        expect(empty).toBeUndefined();
      }

      // Trying to delete already deleted oracle
      await expectException(DEL_ORACLE, { account: oracle1.name }, ACTOR.CONTRACT);

      // Make sure that no rates assigned to oracle1 have been left
      {
        const result = await getById(
          TABLE.RATES,
          stringToName(oracle1.name),
          SYMBOL.EOS.symbolName,
        );
        expect(result).toBeUndefined();
      }

      // Make sure that rates assigned to oracle2 are intact
      {
        const result = await getById(
          TABLE.RATES,
          stringToName(oracle2.name),
          SYMBOL.EOS.symbolName,
        );
        expect(result).toBeDefined();
      }
    });

  });

});