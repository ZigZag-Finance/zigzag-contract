# ZigZag Contract

## Intro

ZigZag Contract is a heart of ZigZag lending platform. It accepts tokenized collateral in EOS network and sends back a loan in ZIG stablecoin. You can find description of its methods below.

## Actions

### setparam

Input parameters:

* `key`   Parameter name
* `value` Parameter new value

The intention of the invoker of this contract is to change existing or create new contract parameter.

### addcollater

Input parameters:

* `symbol`  Collateral symbol (EOS)
* `account` Collateral token account (eosio.token)

The intention of the invoker of this contract is to add a new collateral type to the system. It is created inactive by default.

### setcollater

Input parameters:

* `symbol`    Collateral symbol
* `is_active` Collateral activity flag

The intention of the invoker of this contract is to update the status of a collateral type.

### delcollater

Input parameters:

* `symbol` Collateral symbol

The intention of the invoker of this contract is to delete a disabled collateral from the system and remove it from all contract oracles.

### addoracle

Input parameters:

* `account` Oracle account name
* `symbols` List of collateral symbols supported by this oracle

The intention of the invoker of this contract is to add an oracle to the system.

### setoracle

Input parameters:

* `account` Oracle account name

The intention of the invoker of this contract is to updates the list of collateral symbols supported by a specified oracle.

### deloracle

Input parameters:

* `account` Oracle account name

The intention of the invoker of this contract is to delete an oracle from the list of supported oracles.

### setrate

Input parameters:

* `oracle`     Oracle account name
* `collateral` Collateral symbol to set rate for
* `rate`       New or updated exchange rate

The intention of the invoker of this contract is to update or create a new rate for a collateral type by a particular oracle.

### setinterest

Input parameters:

* `user`       Customer account
* `collateral` Collateral position to update
* `interest`   New daily interest rate for the user-collateral pair

The intention of the invoker of this contract is to updates a daily interest rate for a particular user's position.

### addinterest

Input parameters:

* `name`   User to calculate interest for
* `symbol` Collateral to calculate interest for

The intention of the invoker of this contract is to calculate a daily interest for a particular user's position and add it to amount of that position. Next interest calculation is scheduled after 24 hours.

### liquidate

Input parameters:

* `user`       User to liquidate position for
* `collateral` Collateral to liquidate position for

The intention of the invoker of this contract is to check if a position is due for liquidation. If it is due for liquidation, transfer collateral amount to an account specified in contract parameters, collect liquidation fee and return the rest to user account.