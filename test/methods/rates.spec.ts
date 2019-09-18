import { SYMBOL, overrideParams, TABLE } from './../constants';
import { ACTOR } from "../constants";
import { expectException, expectSuccess, createAccount, createAndIssueCurrency, getById, stringToName } from '../test.utils';
import { EosAccount } from '../helpers/account.helper';
import { EosCurrency } from '../helpers/currency.helper';
import { setupNode } from "../setup";

describe('rates', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

  const SET_RATE = 'setrate';

  const ACCOUNT_COLLATERAL_OTHER: EosAccount = new EosAccount('othercoll').key('5JzaLpLqZU8N9dPLs99BxeiG4nkMUYUHJBMDDhpyAQJVead2obe');
  const CURRENCY_COLLATERAL_OTHER: EosCurrency = new EosCurrency('OTHER', 3).setAccount(ACCOUNT_COLLATERAL_OTHER).setSupply('100000000');

  beforeAll(async () => {
    await setupNode();
    await createAccount(ACCOUNT_COLLATERAL_OTHER);
    await createAndIssueCurrency(CURRENCY_COLLATERAL_OTHER);
    await expectSuccess('addcollater', {
      symbol: CURRENCY_COLLATERAL_OTHER.toString(),
      account: ACCOUNT_COLLATERAL_OTHER.name
    }, ACTOR.CONTRACT);
  });

  describe(SET_RATE, () => {

    const data = {
      oracle: ACTOR.ORACLE_1.name,
      collateral: SYMBOL.EOS.toString(),
      rate: 5.
    }
    const dataNobody = overrideParams(data, 'oracle', ACTOR.NOBODY.name);
    const dataOtherCollateral = overrideParams(data, 'collateral', CURRENCY_COLLATERAL_OTHER.toString());
    const dataZero = overrideParams(data, 'rate', 0.);
    const dataNegative = overrideParams(data, 'rate', -1.);

    it(`${SET_RATE}: fail - signed by contract account`, async () => {
      await expectException(SET_RATE, data, ACTOR.CONTRACT);
    });

    it(`${SET_RATE}: fail - oracle param and signer are different`, async () => {
      await expectException(SET_RATE, data, ACTOR.ORACLE_2);
    });

    it(`${SET_RATE}: fail - no such oracle exists in our system`, async () => {
      await expectException(SET_RATE, dataNobody, ACTOR.NOBODY);
    });

    it(`${SET_RATE}: fail - collateral is not allowed for this oracle`, async () => {
      await expectException(SET_RATE, dataOtherCollateral, ACTOR.ORACLE_1);
    });

    it(`${SET_RATE}: fail - zero or negative rate`, async () => {
      await expectException(SET_RATE, dataZero, ACTOR.ORACLE_1);
      await expectException(SET_RATE, dataNegative, ACTOR.ORACLE_1);
    });

    it(`${SET_RATE}: fail - rate differs too much from median collateral price`, async () => {
      // TODO: Add this test after we finalize median rate calculation
    });

    it(`${SET_RATE}: success - rate added from oracle for collateral`, async () => {
      const resultBefore= await getById(TABLE.RATES, stringToName(data.oracle), SYMBOL.EOS.symbolName);
      expect(resultBefore).toBeUndefined();

      await expectSuccess(SET_RATE, data, ACTOR.ORACLE_1);

      const result = await getById(TABLE.RATES, stringToName(data.oracle), SYMBOL.EOS.symbolName);
      expect(result).toBeDefined();
      expect(+result.rate_to_usd).toBe(data.rate);
    });

  });
});