import { EosAccount } from './account.helper';
import Big from 'big.js';

export class EosCurrency {

  static stringToSymbol(name: string, precision: number): string {
    let result = Big(EosCurrency.stringToSymbolName(name)).times(256);
    result = result.plus(precision);
    return result.toString();
  }
  
  static stringToSymbolName(str: string): string {
    let result = Big(0);
  
    for (let index = 0; index < str.length; index++) {
      const char = str.charCodeAt(index);
      if (char < 'A'.charCodeAt(0) || char > 'Z'.charCodeAt(0)) {
        // Oops
      } else {
        let value = Big(char);
        for (let i = 0; i < index; i++) {
          value = value.times(256);
        }
        result = result.plus(value);
      }
    }
    return result.toString();
  }

  readonly symbol: string;
  readonly symbolName: string;
  account: undefined | EosAccount = undefined;
  supply: undefined | Big = undefined;

  constructor(readonly name: string, readonly precision: number) {
    this.symbol = EosCurrency.stringToSymbol(name, precision);
    this.symbolName = EosCurrency.stringToSymbolName(name);
  }

  toString() {
    return `${this.precision},${this.name}`;
  }

  setAccount(account: EosAccount): EosCurrency {
    this.account = account;
    return this;
  }

  setSupply(supply: string | number | Big): EosCurrency {
    this.supply = new Big(supply);
    return this;
  }

  formatSupply() {
    return `${this.supply.toFixed(this.precision)} ${this.name}`;
  }
}