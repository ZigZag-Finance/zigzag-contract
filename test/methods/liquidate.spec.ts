import Big from 'big.js';

import { expectException, transfer, getAccountBalance, expectSuccess, getById, stringToName, DecimalString } from "../test.utils";
import { ACTOR, SYMBOL, overrideParams, CONTRACT, TABLE, PARAM } from "../constants";
import { setupNode } from "../setup";

describe('liquidate', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

  const LIQUIDATE = 'liquidate';

  beforeAll(async () => {
    await setupNode();
    // Change position.def to 2
    await expectSuccess('setparam', { key: PARAM.POSITION_DEF, value: '2.0' }, ACTOR.CONTRACT); 
  });

  describe(LIQUIDATE, () => {
    const data = { user: ACTOR.ALICE.name, collateral: SYMBOL.EOS.toString() };

    describe(`${LIQUIDATE}: fail`, () => {
      beforeAll(async () => {
        // Open position in EOS
        await transfer(CONTRACT.EOS, ACTOR.ALICE, ACTOR.CONTRACT, '10.0000 EOS');
      })

      afterAll(async () => {
        // Close position with borrowed ZIG
        await Promise.all([
          transfer(CONTRACT.ZIGZAG, ACTOR.CONTRACT, ACTOR.ALICE, '30.0300 ZIG'),
          transfer(CONTRACT.ZIGZAG, ACTOR.ALICE, ACTOR.CONTRACT, '30.0300 ZIG', 'EOS'),
        ]);
      });

      it(`${LIQUIDATE}: fail - signed by wrong key`, async () => {
        await expectException(LIQUIDATE, data, ACTOR.NOBODY, 'Unauthorized');
      });

      it(`${LIQUIDATE}: fail - user not found`, async () => {
        const userNotFoundData = overrideParams(data, 'user', ACTOR.BOB.name);
        await expectException(LIQUIDATE, userNotFoundData, ACTOR.CRON, 'User position does not exist');
      });

      it(`${LIQUIDATE}: fail - collateral not found`, async () => {
        const collateralNotFoundData = overrideParams(data, 'collateral', SYMBOL.BOS.toString());
        await expectException(LIQUIDATE, collateralNotFoundData, ACTOR.CRON, 'Collateral does not exist');
      });
    })

    it(`${LIQUIDATE}: success - not need to liquidate position`, async () => {
      // create new Alice position
      await transfer(CONTRACT.EOS, ACTOR.ALICE, ACTOR.CONTRACT, '10.0000 EOS');

      const balanceEosBefore = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS');
      const balanceDaiBefore = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'ZIG');
      const liquidateBalanceBefore = await getAccountBalance(CONTRACT.EOS, ACTOR.LIQUIDATE.name, 'EOS');

      await expectSuccess(LIQUIDATE, data, ACTOR.CRON);

      const positionBefore = await getById(
        TABLE.POSITIONS, 
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );

      expect(positionBefore).toEqual({
        account: ACTOR.ALICE.name,
        amount_collateral: '10.0000 EOS',
        amount_borrowed: '30.0000 ZIG', // Avarage rate is 6 USD/EOS (10 * 6 / 2)
        amount_interest: '0.0300 ZIG',
        interest_rate: expect.any(String),
        next_interest: expect.any(Number),
      });

      // Close position with borrowed ZIG
      await Promise.all([
        transfer(CONTRACT.ZIGZAG, ACTOR.CONTRACT, ACTOR.ALICE, '30.0300 ZIG'),
        transfer(CONTRACT.ZIGZAG, ACTOR.ALICE, ACTOR.CONTRACT, '30.0300 ZIG', 'EOS'),
      ]);

      // Make sure that position is closed
      const positionAfter = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      await expect(positionAfter).toBeUndefined();

      // Check for Alice balance changes
      const balanceEosAfter = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS');
      expect(balanceEosAfter).toEqual(DecimalString(Number(balanceEosBefore) + 10));

      const balanceDaiAfter = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'ZIG');
      expect(balanceDaiAfter).toEqual(balanceDaiBefore);

      // Make sure liquidation account have no changes
      const liquidateBalanceAfter = await getAccountBalance(CONTRACT.EOS, ACTOR.LIQUIDATE.name, 'EOS');
      expect(liquidateBalanceAfter).toBe(liquidateBalanceBefore);
    });

    it(`${LIQUIDATE}: success - full position liquidation`, async () => {
      // Set interest def to 100%
      await expectSuccess('setparam', { key: 'interest.def', value: '1.0' }, ACTOR.CONTRACT);

      // Create a new Alice position
      await transfer(CONTRACT.EOS, ACTOR.ALICE, ACTOR.CONTRACT, '10.0000 EOS');

      const balanceEosBefore = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS');
      const balanceDaiBefore = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'ZIG');

      const positionBefore = await getById(
        TABLE.POSITIONS, 
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionBefore).toEqual({
        account: ACTOR.ALICE.name,
        amount_collateral: '10.0000 EOS',
        amount_borrowed: '30.0000 ZIG',
        amount_interest: '30.0000 ZIG',
        interest_rate: expect.any(String),
        next_interest: expect.any(Number),
      });

      await expectSuccess(LIQUIDATE, data, ACTOR.CONTRACT);

      const positionAfter = await getById(
        TABLE.POSITIONS, 
        stringToName(ACTOR.ALICE.name), 
        SYMBOL.EOS.symbolName,
      );
      expect(positionAfter).toBeUndefined();

      // Alice's EOS balance should not change
      const balanceEosAfter = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS');
      expect(balanceEosAfter).toBe(balanceEosBefore);

      // Alice's ZIG balance should not change
      const balanceDaiAfter = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'ZIG');
      expect(balanceDaiAfter).toBe(balanceDaiBefore);

      // Liquidation account shoud receive the collateral amount
      const liquidateBalance = await getAccountBalance(CONTRACT.EOS, ACTOR.LIQUIDATE.name, 'EOS');
      expect(liquidateBalance).toBe('10'); 
    });

    it(`${LIQUIDATE}: success - partial position liquidation`, async () => {
      // Set interest def to 50%
      await expectSuccess('setparam', { key: 'interest.def', value: '0.5' }, ACTOR.CONTRACT);

      // Create a new Alice position
      await transfer(CONTRACT.EOS, ACTOR.ALICE, ACTOR.CONTRACT, '10.0000 EOS');

      const balanceEosBefore = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS');
      const liquidateBalanceBefore = await getAccountBalance(CONTRACT.EOS, ACTOR.LIQUIDATE.name, 'EOS');

      const positionBefore = await getById(
        TABLE.POSITIONS, 
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionBefore).toEqual({
        account: ACTOR.ALICE.name,
        amount_collateral: '10.0000 EOS',
        amount_borrowed: '30.0000 ZIG',
        amount_interest: '15.0000 ZIG',
        interest_rate: expect.any(String),
        next_interest: expect.any(Number),
      });

      await expectSuccess(LIQUIDATE, data, ACTOR.CONTRACT);

      // Make sure that the position is removed
      const positionAfter = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionAfter).toBeUndefined();

      // Check if Alice got her share after liquidation fee
      const balanceAfter = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS');
      expect(Big(balanceAfter).minus(balanceEosBefore).toString()).toBe('1'); // 60 * 0.85 - 45 = 6 ZIG = 1 EOS

      // Check if liquidation account got liquidation fee
      const liquidateBalanceAfter = await getAccountBalance(CONTRACT.EOS, ACTOR.LIQUIDATE.name, 'EOS');
      expect(Big(liquidateBalanceAfter).minus(liquidateBalanceBefore).toString()).toBe('9');
    });
  });
  
});