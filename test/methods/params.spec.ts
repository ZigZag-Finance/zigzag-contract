import { expectException, expectSuccess, getById, stringToName } from '../test.utils';
import { ACTOR, TABLE, overrideParams } from '../constants';
import { setupNode } from "../setup";

describe('params', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

  const SET_PARAM = 'setparam';

  beforeAll(async () => {
    await setupNode();
  });

  describe(SET_PARAM, () => {

    const data = {
      key: 'somekey',
      value: 'somevalue'
    };
    const updatedData = overrideParams(data, 'value', 'newvalue');
    const deletingData = overrideParams(data, 'value', '');
    
    it(`${SET_PARAM}: fail - signed by wrong key`, async () => {
      await expectException(SET_PARAM, data, ACTOR.NOBODY);
    });

    it(`${SET_PARAM}: success (new)`, async () => {
      const empty = await getById(TABLE.PARAMS, stringToName(data.key));
      expect(empty).toBeUndefined();

      await expectSuccess(SET_PARAM, data, ACTOR.CONTRACT);

      const result = await getById(TABLE.PARAMS, stringToName(data.key));
      expect(result).toBeDefined();
      expect(result.key).toEqual(data.key);
      expect(result.value).toEqual(data.value);
    });

    it(`${SET_PARAM}: success (overwrite)`, async () => {
      
      await expectSuccess(SET_PARAM, updatedData, ACTOR.CONTRACT);

      const result = await getById(TABLE.PARAMS, stringToName(updatedData.key));
      expect(result).toBeDefined();
      expect(result.key).toEqual(updatedData.key);
      expect(result.value).toEqual(updatedData.value);
    });

    it(`${SET_PARAM}: success (delete)`, async () => {

      const result = await getById(TABLE.PARAMS, stringToName(deletingData.key));
      expect(result).toBeDefined();
      
      await expectSuccess(SET_PARAM, deletingData, ACTOR.CONTRACT);

      const empty = await getById(TABLE.PARAMS, stringToName(deletingData.key));
      expect(empty).toBeUndefined();
    });
  });
});