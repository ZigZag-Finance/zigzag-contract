import { getAccountBalance, getById, DecimalString, stringToName, getUnixTime, setRate, expectException, expectSuccess, sleep, cleosGetActions, transfer } from "../test.utils";
import { ACTOR, TABLE, SYMBOL, CONTRACT, overrideParams } from "../constants";
import { setupNode } from "../setup";

describe('positions', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

  const LOAN = 'loan';
  const SET_INTEREST = 'setinterest';
  const REPAY_LOAN = 'repayloan';
  const ADD_INTEREST = 'addinterest';

  beforeAll(async () => {
    await setupNode();
  });

  describe(LOAN, () => {

    it(`${LOAN}: fail (disabled collateral)`, () => {

      // TODO: add test for send transaction with disabled collateral
    });

    it(`${LOAN}: fail (unsupported currency)`, async () => {
      expect(await getAccountBalance(CONTRACT.BOS, ACTOR.ALICE.name, 'BOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('0');

      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '10.0000 BOS',
        memo: ''
      }, ACTOR.ALICE, CONTRACT.BOS);

      const position = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.BOS.symbolName,
      );
      expect(position).toBeUndefined();

      expect(await getAccountBalance(CONTRACT.BOS, ACTOR.ALICE.name, 'BOS')).toEqual('90');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('0');
    });

    it(`${LOAN}: fail (transaction below threshold)`, async () => {
      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('0');

      await expectException('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '0.0001 EOS',
        memo: ''
      }, ACTOR.ALICE, 'Transfer amount is below 0.1000 EOS threshold', CONTRACT.EOS);

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('0');
    });

    it(`${LOAN}: success (new)`, async () => {
      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('0');
      const start = getUnixTime();

      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '10.0000 EOS',
        memo: ''
      }, ACTOR.ALICE, CONTRACT.EOS);

      const position = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(position).toEqual({
        account: ACTOR.ALICE.name,
        amount_collateral: '10.0000 EOS',
        amount_borrowed: '40.0000 ZIG', // Average rate is 6 USD/EOS (10 * 6 / 1.5)
        amount_interest: '0.0400 ZIG',
        interest_rate: expect.any(String),
        next_interest: expect.any(Number)
      });
      expect(+position.interest_rate).toBe(0.001);

      expect(position.next_interest).toBeGreaterThanOrEqual(start + (24 * 60 * 60));
      expect(position.next_interest).toBeLessThanOrEqual(start + (24 * 60 * 60) + 5);

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('90');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('40');

      {
        const actions = await cleosGetActions(ACTOR.CONTRACT.name, { compact: true });
        const loan = (actions as Array<any>).pop();
        expect(loan.name).toBe('transfer');
        expect(loan.data).toEqual({
          from: ACTOR.CONTRACT.name,
          to: ACTOR.ALICE.name,
          quantity: `40.0000 ZIG`,
          memo: 'Loan status: 40.0400 ZIG to return',
        });
      }
    });

    it(`${LOAN}: success (already has position)`, async () => {
      // Change avarage rate to 4 USD/EOS
      await setRate(ACTOR.ORACLE_3, SYMBOL.EOS, 4);

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('90');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('40');

      const positionBefore = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );

      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '10.0000 EOS',
        memo: ''
      }, ACTOR.ALICE, CONTRACT.EOS);

      const position = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(position).toEqual({
        ...positionBefore,
        amount_collateral: '20.0000 EOS',
        amount_borrowed: '53.2933 ZIG',
      });

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('80');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('53.2933');

      {
        const actions = await cleosGetActions(ACTOR.CONTRACT.name, { compact: true });
        const loan = (actions as Array<any>).pop();
        expect(loan.name).toBe('transfer');
        expect(loan.data).toEqual({
          from: ACTOR.CONTRACT.name,
          to: ACTOR.ALICE.name,
          quantity: `13.2933 ZIG`,
          memo: 'Loan status: 53.3333 ZIG to return',
        });
      }
    });
  });

  describe(SET_INTEREST, () => {
    const data = {
      user: ACTOR.ALICE.name,
      collateral: SYMBOL.EOS.toString(),
      interest: 5.6
    };

    const collateralNotFound = overrideParams(data, 'collateral', SYMBOL.BOS.toString());
    const userNotFound = overrideParams(data, 'user', ACTOR.BOB.name);
    const interestTooSmall = overrideParams(data, 'interest', -0.1000);
    const interestTooHihgt = overrideParams(data, 'interest', 100.1000);
    const managerData = overrideParams(data, 'interest', 98.7000);

    it(`${SET_INTEREST}: fail - signed by invalid account`, async () => {
      await expectException(SET_INTEREST, data, ACTOR.NOBODY, 'Unauthorized');
    });

    it(`${SET_INTEREST}: fail - collateral does not exist in our system`, async () => {
      await expectException(SET_INTEREST, collateralNotFound, ACTOR.CONTRACT, 'Collateral does not exist');
    });

    it(`${SET_INTEREST}: fail - user does not exist in our system`, async () => {
      await expectException(SET_INTEREST, userNotFound, ACTOR.CONTRACT, 'User position does not exist');
    });

    it(`${SET_INTEREST}: fail - interest rate is less than zero`, async () => {
      await expectException(SET_INTEREST, interestTooSmall, ACTOR.CONTRACT, 'Interest too low');
    });

    it(`${SET_INTEREST}: fail - interest rate is more than 100`, async () => {
      await expectException(SET_INTEREST, interestTooHihgt, ACTOR.CONTRACT, 'Interest too high');
    });

    it(`${SET_INTEREST}: success - with system account`, async () => {
      await expectSuccess(SET_INTEREST, data, ACTOR.CONTRACT);
      const position = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(+position.interest_rate).toBe(data.interest);
    });

    it(`${SET_INTEREST}: success - with contract account`, async () => {
      await expectSuccess(SET_INTEREST, managerData, ACTOR.MANAGER);
      const position = await getById(
        TABLE.POSITIONS, 
        stringToName(ACTOR.ALICE.name), 
        SYMBOL.EOS.symbolName,
      );
      expect(+position.interest_rate).toBe(managerData.interest);
    });
  });

  describe(REPAY_LOAN, () => {
    const aliceTransaction = {
      from: ACTOR.ALICE.name,
      to: ACTOR.CONTRACT.name,
      quantity: '10.0000 ZIG',
      memo: SYMBOL.EOS.name
    }
    const bobTransaction = overrideParams(aliceTransaction, 'from', ACTOR.BOB.name);
    const bobNoMemo = overrideParams(bobTransaction, 'memo', '');
    const bobInvalidMemo = overrideParams(bobTransaction, 'memo', SYMBOL.BOS.name);

    it(`${REPAY_LOAN}: fail - default collateral position does not exist (no memo)`, async () => {
      await expectException('transfer', bobNoMemo, ACTOR.BOB, 'User position does not exist', CONTRACT.ZIGZAG);
    });

    it(`${REPAY_LOAN}: fail - collateral not found (invalid memo)`, async () => {
      await expectException('transfer', bobInvalidMemo, ACTOR.BOB, 'Collateral does not exist', CONTRACT.ZIGZAG);
    });

    it(`${REPAY_LOAN}: fail - user position not found`, async () => {
      await expectException('transfer', bobTransaction, ACTOR.BOB, 'User position does not exist', CONTRACT.ZIGZAG);
      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.BOB.name, 'EOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.BOB.name, 'ZIG')).toEqual('100');
    });

    it(`${REPAY_LOAN}: fail - payment under threshold`, async () => {
      await expectException('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '0.0001 ZIG',
        memo: SYMBOL.EOS.name,
      }, ACTOR.ALICE, 'Transfer amount is below 0.1000 ZIG threshold', CONTRACT.ZIGZAG);
      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.BOB.name, 'EOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.BOB.name, 'ZIG')).toEqual('100');
    });

    it(`${REPAY_LOAN}: success - partial repayment (no memo)`, async () => {
      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('80');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('53.2933');

      const positionBefore = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionBefore).toEqual(expect.objectContaining({
        amount_collateral: '20.0000 EOS',
        amount_borrowed: '53.2933 ZIG',
        amount_interest: '0.0400 ZIG',
      }));

      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '5.0000 ZIG',
        memo: '',
      }, ACTOR.ALICE, CONTRACT.ZIGZAG);

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('80');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('48.2934'); // Plus 0.0001 ZIG for transfer with memo notification

      const positionAfter = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionAfter).toEqual(expect.objectContaining({
        amount_collateral: '20.0000 EOS',
        amount_borrowed: '48.3333 ZIG',
        amount_interest: '0.0000 ZIG',
      }));
    });

    it(`${REPAY_LOAN}: success - partial repayment (standard)`, async () => {
      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('80');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('48.2934');

      const positionBefore = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionBefore).toEqual(expect.objectContaining({
        amount_collateral: '20.0000 EOS',
        amount_borrowed: '48.3333 ZIG',
        amount_interest: '0.0000 ZIG',
      }));

      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '5.0000 ZIG',
        memo: SYMBOL.EOS.name,
      }, ACTOR.ALICE, CONTRACT.ZIGZAG);

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('80');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('43.2935'); // Plus 0.0001 ZIG for transfer with memo notification

      const positionAfter = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionAfter).toEqual(expect.objectContaining({
        amount_collateral: '20.0000 EOS',
        amount_borrowed: '43.3333 ZIG',
        amount_interest: '0.0000 ZIG',
      }));
    });

    it(`${REPAY_LOAN}: success - close position`, async () => {
      // Issue ZIG to Alice
      await transfer(CONTRACT.ZIGZAG, ACTOR.CONTRACT, ACTOR.ALICE, '10.0000 ZIG');

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('80');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('53.2935');

      const positionBefore = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionBefore).toEqual(expect.objectContaining({
        amount_collateral: '20.0000 EOS',
        amount_borrowed: '43.3333 ZIG',
        amount_interest: '0.0000 ZIG',
      }));

      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '43.5000 ZIG',
        memo: SYMBOL.EOS.name,
      }, ACTOR.ALICE, CONTRACT.ZIGZAG);

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('9.9602'); // 53.2934 - 43.5000 + 0.1667 (change)

      const positionAfter = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionAfter).toBeUndefined();
    });

    it(`${REPAY_LOAN}: success - close position with overkill`, async () => {
      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '20.0000 EOS',
        memo: '',
      }, ACTOR.ALICE, CONTRACT.EOS);

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('80');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('63.2935');

      const positionBefore = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionBefore).toEqual(expect.objectContaining({
        amount_collateral: '20.0000 EOS',
        amount_borrowed: '53.3333 ZIG',
        amount_interest: '0.0533 ZIG',
      }));

      await expectSuccess('transfer', {
        from: ACTOR.ALICE.name,
        to: ACTOR.CONTRACT.name,
        quantity: '53.3866 ZIG',
        memo: SYMBOL.EOS.name,
      }, ACTOR.ALICE, CONTRACT.ZIGZAG);

      const positionAfter = await getById(
        TABLE.POSITIONS,
        stringToName(ACTOR.ALICE.name),
        SYMBOL.EOS.symbolName,
      );
      expect(positionAfter).toBeUndefined();

      expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS')).toEqual('100');
      expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG')).toEqual('9.9069'); // 63.2934 - 53.3866
    });
  });

  describe(ADD_INTEREST, () => {
    const data = {user: ACTOR.ALICE.name, collateral: SYMBOL.EOS.toString()};
    const userNotFoundData = overrideParams(data, 'user', ACTOR.BOB.name);
    const collateralNotFoundData = overrideParams(data, 'collateral', SYMBOL.BOS.toString());

    beforeAll(async () => {
        // set interast interval to 1 seccond
        await expectSuccess('setparam', { key: 'interest.int', value: '1' }, ACTOR.CONTRACT);

        // create a new Alice position
        await expectSuccess('transfer', {
          from: ACTOR.ALICE.name,
          to: ACTOR.CONTRACT.name,
          quantity: '10.0000 EOS',
          memo: '',
        }, ACTOR.ALICE, CONTRACT.EOS);
  
    });

    it(`${ADD_INTEREST}: success`, async () => {
        const eosBalance = await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS'); // 90;

        const position = await getById(
          TABLE.POSITIONS,
          stringToName(ACTOR.ALICE.name),
          SYMBOL.EOS.symbolName,
        );

        await sleep(3000);

        const positionAfterSleep = await getById(
          TABLE.POSITIONS,
          stringToName(ACTOR.ALICE.name),
          SYMBOL.EOS.symbolName,
        );
        expect(Number.parseFloat(positionAfterSleep.amount_interest))
          .toBeGreaterThan(Number.parseFloat(position.amount_interest));

        expect(await getAccountBalance(CONTRACT.EOS, ACTOR.ALICE.name, 'EOS'))
          .toEqual(eosBalance);
        expect(await getAccountBalance(CONTRACT.ZIGZAG, ACTOR.ALICE.name, 'ZIG'))
          .toEqual('36.5738');
    });

    it(`${ADD_INTEREST}: fail - signed by wrong key`, async () => {
        await expectException(ADD_INTEREST, data, ACTOR.NOBODY, 'missing authority of zigzag');
    });

    it(`${ADD_INTEREST}: fail - user not found`, async () => {
        await expectException(ADD_INTEREST, userNotFoundData, ACTOR.CONTRACT, 'Position does not exist');
    });

    it(`${ADD_INTEREST}: fail - collateral not found`, async () => {
        await expectException(ADD_INTEREST, collateralNotFoundData, ACTOR.CONTRACT, 'Collateral does not exist');
    });

    it(`${ADD_INTEREST}: success - empty call`, async () => {
        await expectSuccess(ADD_INTEREST, data, ACTOR.CONTRACT);
    });
  });
})