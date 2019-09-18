<h1 class="contract">setparam</h1>

Input parameters:

* `key`   Parameter name
* `value` Parameter new value

### Intent
INTENT. The intention of the invoker of this contract is to change existing or create new contract parameter.

<h1 class="contract">addcollater</h1>

Input parameters:

* `symbol`  Collateral symbol (EOS)
* `account` Collateral token account (eosio.token)

### Intent
INTENT. The intention of the invoker of this contract is to add a new collateral type to the system. It is created inactive by default.

<h1 class="contract">setcollater</h1>

Input parameters:

* `symbol`    Collateral symbol
* `is_active` Collateral activity flag

### Intent
INTENT. The intention of the invoker of this contract is to update the status of a collateral type.

<h1 class="contract">delcollater</h1>

Input parameters:

* `symbol` Collateral symbol

### Intent
INTENT. The intention of the invoker of this contract is to delete a disabled collateral from the system and remove it from all contract oracles.

<h1 class="contract">addoracle</h1>

Input parameters:

* `account` Oracle account name
* `symbols` List of collateral symbols supported by this oracle

### Intent
INTENT. The intention of the invoker of this contract is to add an oracle to the system.

<h1 class="contract">setoracle</h1>

Input parameters:

* `account` Oracle account name

### Intent
INTENT. The intention of the invoker of this contract is to updates the list of collateral symbols supported by a specified oracle.

<h1 class="contract">deloracle</h1>

Input parameters:

* `account` Oracle account name

### Intent
INTENT. The intention of the invoker of this contract is to delete an oracle from the list of supported oracles.

<h1 class="contract">setrate</h1>

Input parameters:

* `oracle`     Oracle account name
* `collateral` Collateral symbol to set rate for
* `rate`       New or updated exchange rate

### Intent
INTENT. The intention of the invoker of this contract is to update or create a new rate for a collateral type by a particular oracle.

<h1 class="contract">setinterest</h1>

Input parameters:

* `user`       Customer account
* `collateral` Collateral position to update
* `interest`   New daily interest rate for the user-collateral pair

### Intent
INTENT. The intention of the invoker of this contract is to updates a daily interest rate for a particular user's position.

<h1 class="contract">addinterest</h1>

Input parameters:

* `name`   User to calculate interest for
* `symbol` Collateral to calculate interest for

### Intent
INTENT. The intention of the invoker of this contract is to calculate a daily interest for a particular user's position and add it to amount of that position. Next interest calculation is scheduled after 24 hours.

<h1 class="contract">liquidate</h1>

Input parameters:

* `user`       User to liquidate position for
* `collateral` Collateral to liquidate position for

### Intent
INTENT. The intention of the invoker of this contract is to check if a position is due for liquidation. If it is due for liquidation, transfer collateral amount to an account specified in contract parameters, collect liquidation fee and return the rest to user account.