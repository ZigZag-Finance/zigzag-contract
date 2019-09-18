#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/action.hpp>
#include <eosio/system.hpp>
#include <eosio/transaction.hpp>
#include <cmath>

using namespace eosio;

/* Maximum allowed number of oracles **/
#define MAX_ORACLES name("max.oracles")
#define POSITION_DEF name("position.def")
#define INTEREST_DEF name("interest.def")
#define INTEREST_INT name("interest.int")
#define LIQUIDATE_THRESHOLD name("liquidate.th")
#define PENALTY name("penalty")
#define MANAGER name("manager")
#define LIQUIDATE_ACCOUNT name("liquid.addr")
#define CRON_ACCOUNT name("cron.account")

#define ZIGZAG_NAME name("zigtokenhome")

#define DEFAULT_COLLATERAL_SYMBOL "EOS"
#define ZIG_SYMBOL symbol("ZIG", 4)
#define NOTIFICATION_AMOUNT asset(1, ZIG_SYMBOL)

#define PERMISSION_LEVEL { permission_level(get_self(), name("active")) }

class [[eosio::contract("zigzag")]] zigzag : public contract {

public:

   using contract::contract;
   zigzag(name receiver, name code, datastream<const char*> ds):contract(receiver, code, ds) {

   }

   [[eosio::action]]
   /**
    * Change existing or create new parameter
    * 
    * @sign Contract active key
    * 
    * @param name    Parameter name
    * @param value   Parameter new value
    * 
    * @throws When signed not by contract active key
    **/
   void setparam(name key, std::string value);

   [[eosio::action]]
   /**
    * Add new collateral type to the system. It is created inactive by default
    * 
    * @sign Contract active key
    * 
    * @param symbol  Collateral symbol (EOS)
    * @param account Collateral token account (eosio.token)
    * 
    * @throws When signed not by contract active key
    * @throws When such account does not exist
    * @throws When such symbol-account combination does not exist
    * @throws When collateral with this symbol already exists
    **/
   void addcollater(symbol symbol, name account);

   [[eosio::action]]
   /**
    * Edits collateral activity status
    * 
    * @sign Contract active key
    * 
    * @param symbol     Collateral symbol
    * @param is_active  Collateral activity flag
    * 
    * @throws When signed not by contract active key
    * @throws When such symbol does not exist in the table
    **/
   void setcollater(symbol symbol, bool is_active);

   [[eosio::action]]
   /**
    * Delete disabled collateral from the system, removes it from all oracles
    * 
    * @sign Contract active key
    * 
    * @param symbol  Collateral symbol
    * 
    * @throws When signed not by contract active key
    * @throws When this symbol does not exist
    * @throws When this symbol is still active
    * @throws When this symbol is inactive, but the are non-liquidated positions for this symbol
    **/
   void delcollater(symbol symbol);

   [[eosio::action]]
   /**
    * Adds oracle to the system
    * 
    * @sign Contract active key
    * 
    * @param account    Oracle account
    * @param symbols    List of collateral symbols supported by this oracle
    * 
    * @throws When signed not by contract active key
    * @throws When such account does not exist
    * @throws When such oracle already exists in the system
    * @throws When at least one symbol in the symbols list does not exist as collateral in the system
    * @throws When number of oracles in the system is more than maximum allowed
    **/
   void addoracle(name account, std::vector<symbol> symbols);

   [[eosio::action]]
   /**
    * Updates list of collateral symbols supported by this oracle
    * 
    * @sign Contract active key
    * 
    * @param account    Oracle account
    * @param symbols    List of collateral symbols supported by this oracle
    * 
    * @throws When signed not by contract active key
    * @throws When such oracle does not exist in the system
    * @throws When at least one symbol in the symbols list does not exist as collateral in the system
    **/
   void setoracle(name account, std::vector<symbol> symbols);

   [[eosio::action]]
   /**
    * Deletes existing oracle
    * 
    * @sign Contract active key
    * 
    * @param account    Oracle account
    * 
    * @throws When signed not by contract active key
    * @throws When such oracle does not exist in the system
    **/
   void deloracle(name account);

   [[eosio::action]]
   /**
    * Updates or creates new rate for collateral by a particular oracle
    * 
    * @sign By one of the oracle active keys
    * 
    * @param oracle     Oracle account name
    * @param collateral Collateral symbol to set rate for
    * @param rate       New or updated exchange rate
    * 
    * @throws When signing account is not the same as oracle param
    * @throws WHen such oracle does not exist in our system
    * @throws When such collateral is not allowed for this oracle
    * @throws When rate is zero or negative
    * @throws When rate is differs by more than a constant perscentage from the median rate for this collateral (unless there were no rates for this oracle)
    **/
   void setrate(name oracle, symbol collateral, double rate);

   [[eosio::action]]
   /**
    * Updates daily interest rate for a particular user's position
    * 
    * @sign By designated manager account (from settings)
    * 
    * @param user       Customer account
    * @param collateral Collateral position to update
    * @param interest   New daily interest rate for the user-collateral pair
    * 
    * @throws When signed not by the manager account
    * @throws When user does not exist in our system
    * @throws When collateral does not exist in our system
    * @throws When user-collateral pair does not exist in our system
    * @throws When interest rate is less than zero or more than 100 (high percentage rate is allowed to force position to close)
    **/
   void setinterest(name user, symbol collateral, double interest);

   [[eosio::action]]
   /**
    * Calculates interest for a particular user's position (called from cron processor)
    * Interest is added daily to the amount_interest according to the current user-collateral daily interest rate applied to amount_borrowed
    * Also next_interest interest value is update to +24h
    * 
    * @sign By designated cron account (from settings)
    * 
    * @param user       User to calculate interest for
    * @param collateral Collateral to calculate interest for
    * 
    * @throws When signed not by cron account
    * @throws When user does not exist in the system
    * @throws When collateral does not exist in our system
    * @throws When user-collateral pair does not exist in our system
    * @throws When next_interest is in the future for this user-collateral pair
    **/
   void addinterest(name user, symbol collateral);

   // Logic of addinterest
   asset calcinterest(name user, symbol collateral, bool is_notify);

   [[eosio::action]]
   /**
    * Liquidates position with critically low liquidity
    * Checks if position is due for liquidation (amount_collateral * median_rate(collateral) < param(rate.liq) * (amount_borrowed + amount_interest)
    * Sends amount_collateral to account specified in settings (for selling)
    * Collects param(rate.penalty) from (amount_collateral * median_rate(collateral) - (amount_borrowed + amount_interest)) and returns rest to the user account
    * Closes position (deletes collateral-user record in positions table)
    * 
    * @sign By designated cron account (from settings)
    * 
    * @param user       User to calculate interest for
    * @param collateral Collateral to calculate interest for
    * 
    * @throws When signed not by cron account
    * @throws When user does not exist in the system
    * @throws When collateral does not exist in our system
    * @throws When user-collateral pair does not exist in our system
    * @throws When position is not due for liquidation
    **/
   void liquidate(name user, symbol collateral);

   /**
    * Notify method on EOS transfer
    * Adds received EOS as collateral to existing position or creates a new one
    * Then EOS/ZIG ration of the position is calculated, if it is higher than param(rate.default) then enough ZIG is sent back to the sender to make position rate equal to param(rate.default)
    **/
   void transfereos(name from, name to, asset quantity, std::string memo);

   /**
    * Notify method on EOS transfer
    * If there is an open position then amount_interest and amount_borrowed are deduced by the sent amount (interest first)
    * If both amount_interest and amount_borrowed are 0 then position is closed and collateral EOS is sent back to the sender
    * All remaining ZIG are sent back to the sender
    **/
   void transferzig(name from, name to, asset quantity, std::string memo);

   /**
    * Notify method on all collaterals transfer
    * If symbol is in collaterals list, and user has no position, open new one. Or if user already has position, update it, and send ZIG, if we can do it.
    * Then ration of the position is calculated, if it is higher than param(rate.default) then enough ZIG is sent back to the sender to make position rate equal to param(rate.default)
    * 
    * @throws When collateral does not exist in our system
    * @throws When enough ZIG balance to send
    **/
   void loan(name from, name to, asset quantity, std::string memo);

private:
   /** 
    * Table storing contract parameters 
    * 
    * @scope      self 
    **/
   struct [[eosio::table]] param_item {
      name key;                        // Parameter key
      std::string value;               // Parameter value (can be interpreted as int or double, depending on the key)

      uint64_t primary_key() const { return key.value; }
   };
   typedef eosio::multi_index<name("params"), param_item> param_index;

   /** 
    * Table with the list of all allowed collaterals (EOS and possibly other tokens) 
    *
    * @scope      self 
    **/
   struct [[eosio::table]] collateral_item {
      symbol symbol;                   // Collateral symbol
      name account;                    // Collateral account name
      bool is_active;

      uint64_t primary_key() const { return symbol.code().raw(); }   // IMPORTANT: Table is indexed by symbol code without precision
   };
   typedef eosio::multi_index<name("collaterals"), collateral_item> collateral_index;

   /** 
    * Table with all oracle accounts (the ones allowed to change exchange rates in the system) 
    *
    * @scope      self
    **/
   struct [[eosio::table]] oracle_item {
      name account;                    // Oracle account
      std::vector<symbol> symbols;     // List of symbols supported by this oracle

      uint64_t primary_key() const { return account.value; }
   };
   typedef eosio::multi_index<name("oracles"), oracle_item> oracle_index;

   /** 
    * Table exchange rates for all collaterals from all oracles
    * 
    * @scope      Collateral symbol code (without precision)
    */
   struct [[eosio::table]] rate_item {
      name account;                    // Oracle account reporting the rate
      double rate_to_usd;              // Rate to usd (amount * rate_to_usd = amount_usd)

      uint64_t primary_key() const { return account.value; }
   };
   typedef eosio::multi_index<name("rates"), rate_item> rate_index;

   /** 
    * Table with all positions opened by our users 
    * 
    * @scope      Collateral symbol code (without precision)
    **/
   struct [[eosio::table]] position_item {
      name account;                    // User account who opened the position
      asset amount_collateral;         // Amount sent to the smart contract as collateral
      asset amount_borrowed;           // Amount of USD (as zigtokenhome) borrowed for the collateral
      asset amount_interest;           // Amount of interest calculated on the amount_borrowed

      double interest_rate;            // Daily interest rate for this position (set to default from params, but could be adjusted)

      uint32_t next_interest;          // Next time amount_interest will be updated

      uint64_t primary_key() const { return account.value; }
   };
   typedef eosio::multi_index<name("positions"), position_item> position_index;

   double get_average_rate(symbol collateral);
   void send_loan_status_notification(name user, asset amount);
   void send_notification(name user, std::string notification);
   uint128_t get_deferred_tx_id(name user, symbol collateral);

   std::string get_param_string(name key) {
      param_index params(get_self(), get_self().value);
      auto iterator = params.find(key.value);
      check(iterator != params.end(), key.to_string() + " param not found");
      return iterator->value;
   }

   int get_param_int(name key) {
      auto value = get_param_string(key);
      return stoi(value);
   }

   double _stod(std::string s)
    {   
        if (s == "") return 0;
        std::size_t i = s.find(".");
        int digits = s.length() - i - 1;
        s.erase(i, 1); 
        return atoi(s.c_str()) / pow(10, digits);
    }  

   double get_param_double(name key) {
      auto value = get_param_string(key);
      return _stod(value);
   }

   asset convert_asset(asset from, symbol to, double rate) {
      double amount_from = from.amount / pow(10, from.symbol.precision());
      double amount_to = amount_from * rate;
      return asset(amount_to * pow(10, to.precision()), to);
   }

   std::string get_loan_memo(asset amount) {
      return std::string("Loan status: " + amount.to_string() + " to return");
   }
};