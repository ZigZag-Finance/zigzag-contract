import { expectException, expectSuccess, getById, createAccount, createAndIssueCurrency } from "../test.utils";
import { ACTOR, SYMBOL, overrideParams, TABLE } from "../constants";
import { EosAccount } from "../helpers/account.helper";
import { EosCurrency } from "../helpers/currency.helper";
import { setupNode } from "../setup";

describe('collaterals', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

  const ADD_COLLATERAL = 'addcollater';
  const SET_COLLATERAL = 'setcollater';
  const DEL_COLLATERAL = 'delcollater';

  const ACCOUNT_CURRENCY_NEW: EosAccount = new EosAccount('newcollatera').key('5JrVFZuz231sgQ1UQsGaGJnDkpSFqMbSXJmJd2MVpH2jrbG9Jsu');
  const CURRENCY_NEW: EosCurrency = new EosCurrency(SYMBOL.NEW.name, 8).setAccount(ACCOUNT_CURRENCY_NEW).setSupply('100000000');//, `100000000.00000000 ${SYMBOL.NEW.name}`);

  beforeAll(async () => {
    await setupNode();
    await createAccount(ACCOUNT_CURRENCY_NEW);
    await createAndIssueCurrency(CURRENCY_NEW);
  });

  describe(ADD_COLLATERAL, () => {

    const data = {
      symbol: SYMBOL.NEW.toString(),
      account: ACCOUNT_CURRENCY_NEW.name
    };
    const unknownAccount = overrideParams(data, 'account', ACTOR.FAKE.name);
    const wrongSymbol = overrideParams(data, 'symbol', SYMBOL.NOT_EXISTING.toString());
    const wrongPrecision = overrideParams(data, 'symbol', SYMBOL.NEW_SYMBOL_WRONG_RECISION.toString());
    const accountNotToken = overrideParams(data, 'account', ACTOR.NOBODY.name);

    it(`${ADD_COLLATERAL}: fail - signed by invalid account`, async () => {
      await expectException(ADD_COLLATERAL, data, ACTOR.NOBODY);
    });

    it(`${ADD_COLLATERAL}: fail - collateral account does not exist`, async () => {
      await expectException(ADD_COLLATERAL, unknownAccount, ACTOR.CONTRACT);
    });

    it(`${ADD_COLLATERAL}: fail - currency with symbol does not exist on this account`, async () => {
      await expectException(ADD_COLLATERAL, wrongSymbol, ACTOR.CONTRACT);
      await expectException(ADD_COLLATERAL, accountNotToken, ACTOR.CONTRACT);
    });

    it(`${ADD_COLLATERAL}: success - collateral added`, async () => {
      const empty = await getById(TABLE.COLLATERALS, SYMBOL.NEW.symbolName);
      expect(empty).toBeUndefined();

      await expectSuccess(ADD_COLLATERAL, data, ACTOR.CONTRACT);

      const result = await getById(TABLE.COLLATERALS, SYMBOL.NEW.symbolName);
      expect(result).toBeDefined();
      expect(result.symbol).toEqual(data.symbol);
      expect(result.account).toEqual(data.account);
      expect(result.is_active).toEqual(0);
    });

    it(`${ADD_COLLATERAL}: fail - collateral with this symbol already added`, async () => {
      await expectException(ADD_COLLATERAL, wrongPrecision, ACTOR.CONTRACT);
      await expectException(ADD_COLLATERAL, data, ACTOR.CONTRACT);
    });

  });

  describe(SET_COLLATERAL, () => {

    const data = {
      symbol: SYMBOL.NEW.toString(),
      is_active: 1
    };
    const dataNotFound = overrideParams(data, 'symbol', SYMBOL.NOT_EXISTING.toString());

    it(`${SET_COLLATERAL}: fail - signed by invalid account`, async () => {
      await expectException(SET_COLLATERAL, data, ACTOR.NOBODY);
    });

    it(`${SET_COLLATERAL}: fail - collateral with this symbol not found`, async () => {
      await expectException(SET_COLLATERAL, dataNotFound, ACTOR.CONTRACT);
    });

    it(`${SET_COLLATERAL}: success - collateral activity updated`, async () => {

      const resultBefore = await getById(TABLE.COLLATERALS, SYMBOL.NEW.symbolName);
      expect(resultBefore.is_active).toEqual(0);

      await expectSuccess(SET_COLLATERAL, data, ACTOR.CONTRACT);

      const result = await getById(TABLE.COLLATERALS, SYMBOL.NEW.symbolName);
      expect(result).toBeDefined();
      expect(result.symbol).toEqual(data.symbol);
      expect(result.account).toEqual(ACCOUNT_CURRENCY_NEW.name);
      expect(result.is_active).toEqual(1);
    });

  });

  describe(DEL_COLLATERAL, () => {

    const data = {
      symbol: SYMBOL.NEW.toString()
    };
    const dataNotFound = overrideParams(data, 'symbol', SYMBOL.NOT_EXISTING.toString());

    it(`${DEL_COLLATERAL}: fail - signed by invalid account`, async () => {
      await expectException(DEL_COLLATERAL, data, ACTOR.NOBODY);
    });

    it(`${DEL_COLLATERAL}: fail - collateral with this symbol not found`, async () => {
      await expectException(DEL_COLLATERAL, dataNotFound, ACTOR.CONTRACT);
    });

    it(`${DEL_COLLATERAL}: fail - collateral is active`, async () => {
      await expectException(DEL_COLLATERAL, data, ACTOR.CONTRACT);
    });

    it(`${DEL_COLLATERAL}: fail - collateral in inactive, but there are still not liquidated positions for it`, async () => {
      // TODO: Add this test when we'll have active positions for users and collaterals
    });

    it(`${DEL_COLLATERAL}: success - collateral deleted`, async () => {

      await expectSuccess(SET_COLLATERAL, {
        symbol: SYMBOL.NEW.toString(),
        is_active: 0
      }, ACTOR.CONTRACT);

      await expectSuccess(DEL_COLLATERAL, data, ACTOR.CONTRACT);

      const result = await getById(TABLE.COLLATERALS, SYMBOL.NEW.symbolName);
      expect(result).toBeUndefined();

      // TODO: Add oracle with deleted symbol and check if the symbol is deleted from oraccle's list
    });

  });

});