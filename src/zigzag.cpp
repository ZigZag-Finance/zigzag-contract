#include "zigzag.hpp"

using namespace eosio;

void zigzag::setparam(name key, std::string value) {
   /** Throw if signed by wrong account **/
   require_auth(get_self());

   /** Init params table and search for existing record **/
   param_index params(get_self(), get_self().value);
   auto iterator = params.find(key.value);
   if (iterator == params.end()) {

      /** Create new parameter record with this key if does not exist **/
      params.emplace(get_self(), [&](auto& row) {
         row.key = key;
         row.value = value;
      });
   } else {

      /** Check if new value is empty **/
      if (value.length() == 0) {

         /** Delete existing parameter **/
         params.erase(iterator);
      } else {

         /** Update existing key value if does not exist **/
         params.modify(iterator, get_self(), [&](auto& row) {
            row.value = value;
         });
      }
   }
}

void zigzag::addcollater(symbol symbol, name account) {

   struct currency_stats {
      asset    supply;
      asset    max_supply;
      name     issuer;

      uint64_t primary_key()const { return supply.symbol.code().raw(); }
   };

   typedef eosio::multi_index<name("stat"), currency_stats> stats;

   /** Throw if signed by wrong account **/
   require_auth(get_self());

   /** Check if account exists **/
   check(is_account(account), "Account does not exist");

   /** Check if there is a token emission on this account **/
   stats statstable(account, symbol.code().raw());
   auto existing = statstable.find(symbol.code().raw());
   check(existing != statstable.end(), "Token with symbol does not exist");

   /** Check if collateral with this symbol already exists **/
   collateral_index collateral(get_self(), get_self().value);
   auto iterator = collateral.find(symbol.code().raw());
   check(iterator == collateral.end(), "Collateral already added");

   /** Create new parameter record with this key if does not exist **/
   collateral.emplace(get_self(), [&](auto& row) {
      row.symbol = symbol;
      row.account = account;
      row.is_active = false;
   });
}

void zigzag::setcollater(symbol symbol, bool is_active) {

   /** Throw if signed by wrong account **/
   require_auth(get_self());

   /** Check if collateral with this symbol exists **/
   collateral_index collateral(get_self(), get_self().value);
   auto iterator = collateral.find(symbol.code().raw());
   check(iterator != collateral.end(), "Collateral does not exist");

   /** Continue only if status has changed **/
   const auto& record = *iterator;
   if (record.is_active != is_active) {

      /** Update collateral status **/
      collateral.modify(iterator, get_self(), [&](auto& row) {
         row.is_active = is_active;
      });
   }
}

void zigzag::delcollater(symbol symbol) {

   /** Throw if signed by wrong account **/
   require_auth(get_self());

   /** Check if collateral with this symbol exists **/
   collateral_index collateral(get_self(), get_self().value);
   auto iterator = collateral.find(symbol.code().raw());
   check(iterator != collateral.end(), "Collateral does not exist");

   /** Only allow deleting inactive collaterals **/
   const auto& record = *iterator;
   check(!record.is_active, "Collateral is active");

   /** TODO: Check for active positions with this collateral **/

   /** Delete collateral **/
   collateral.erase(iterator);

   /** TODO: Modify all oracles to remove this collateral from their list **/
}

void zigzag::addoracle(name account, std::vector<symbol> symbols) {

   /** Throw if signed by wrong account **/
   require_auth(get_self());

   /** Check if account exists **/
   check(is_account(account), "Account does not exist");

   /** Check if oracle with this account already exists **/
   oracle_index oracle(get_self(), get_self().value);
   auto iterator = oracle.find(account.value);
   check(iterator == oracle.end(), "Oracle already added");

   /** Check if all symbols exist in our collateral table **/
   collateral_index collateral(get_self(), get_self().value);
   for (auto &symbol : symbols) {
      auto symbol_iterator = collateral.find(symbol.code().raw());
      check(symbol_iterator != collateral.end(), "Symbol does not exist");
   }
   
   /** Check number of oracles already in the system and compare them with max.oracles **/
   auto max_oracles = get_param_int(MAX_ORACLES);
   int size = 0;
   for (auto itr = oracle.begin(); itr != oracle.end(); itr++, size++)
      ;
   check(size < max_oracles, "Too many oracles");

   /** Add oracle to the storage **/
   oracle.emplace(get_self(), [&](auto& row) {
      row.account = account;
      row.symbols = symbols;
   });
}

void zigzag::setoracle(name account, std::vector<symbol> symbols) {

   /** Throw if signed by wrong account **/
   require_auth(get_self());

   /** Check if oracle with this account exists **/
   oracle_index oracle(get_self(), get_self().value);
   auto iterator = oracle.find(account.value);
   check(iterator != oracle.end(), "Oracle does not exist");

   /** Check if all symbols exist in our collateral table **/
   collateral_index collateral(get_self(), get_self().value);
   for (auto &symbol : symbols) {
      auto symbol_iterator = collateral.find(symbol.code().raw());
      check(symbol_iterator != collateral.end(), "Symbol does not exist");
   }

   /** Update oracle record **/
   oracle.modify(iterator, get_self(), [&](auto& row) {
      row.symbols = symbols;
   });
}

void zigzag::deloracle(name account) {

   /** Throw if signed by wrong account **/
   require_auth(get_self());

   /** Check if oracle with this account exists **/
   oracle_index oracle(get_self(), get_self().value);
   auto oracle_iterator = oracle.find(account.value);
   check(oracle_iterator != oracle.end(), "Oracle does not exist");

   /** Delete all rates for all collaterals reported by this oracle **/
   collateral_index collateral(get_self(), get_self().value);
   for (auto collateral_iterator = collateral.begin(); collateral_iterator != collateral.end(); collateral_iterator++) {
      rate_index rate_table(get_self(), collateral_iterator->symbol.code().raw());
      for (auto itr = rate_table.begin(); itr != rate_table.end();) {
         if (itr->account == oracle_iterator->account) {
            itr = rate_table.erase(itr);
         } else {
            itr++;
         }
      }
   }

   /** Delete oracle **/
   oracle.erase(oracle_iterator);
}

void zigzag::setrate(name oracle, symbol collateral, double rate) {

   /** Check oracle and signer are same **/   
   require_auth(oracle);

   /** Check if oracle with this account exists **/
   oracle_index oracle_table(get_self(), get_self().value);
   auto oracle_iterator = oracle_table.find(oracle.value);
   check(oracle_iterator != oracle_table.end(), "Oracle does not exist");
   
   /** Check if oracle has symbol **/
   const auto& record = *oracle_iterator;
   const auto has_symbol = std::find(record.symbols.begin(), record.symbols.end(), collateral) != record.symbols.end();
   check(has_symbol, "Symbol is not supported by this oracle");

   /** Check if rate is graten then zero **/
   check(rate > 0, "Rate must be greater then zero");

   /** Try to find rate record **/
   rate_index rate_table(get_self(), collateral.code().raw());
   auto rate_iterator = rate_table.find(oracle.value);

   /** Update rate if already exists **/
   if (rate_iterator != rate_table.end()) {
      rate_table.modify(rate_iterator, oracle, [&](auto& row) {
         row.rate_to_usd = rate;
      });

   /** Create new rate if was not found **/
   } else {
      rate_table.emplace(oracle, [&](auto& row) {
         row.rate_to_usd = rate;
         row.account = oracle;
      });
   }
}

void zigzag::setinterest(name user, symbol collateral, double interest) {
   /** Check authorization **/
   auto system_user = get_param_string(MANAGER);
   check(has_auth(name(system_user)) || has_auth(name(get_self())), "Unauthorized");

   /** Check if collateral with this symbol exists **/
   collateral_index collateral_table(get_self(), get_self().value);
   auto collateral_iterator = collateral_table.find(collateral.code().raw());
   check(collateral_iterator != collateral_table.end(), "Collateral does not exist");

   /** Check if user position exists **/
   position_index position_table(get_self(), collateral.code().raw());
   auto position_iterator = position_table.find(user.value);
   check(position_iterator != position_table.end(), "User position does not exist");

   /** Check interest range **/
   check(interest >= 0, "Interest too low");
   check(interest <= 100, "Interest too high");

   /** Set interest **/
   position_table.modify(position_iterator, get_self(), [&](auto& row) {
      row.interest_rate = interest;
   });   
}

asset zigzag::calcinterest(name user, symbol collateral, bool is_notify) {
   /** Check if collateral with this symbol exists **/
   collateral_index collateral_table(get_self(), get_self().value);
   auto collateral_iterator = collateral_table.find(collateral.code().raw());
   check(collateral_iterator != collateral_table.end(), "Collateral does not exist");

   /** Check if position for collateral with this symbol exists **/
   position_index position_table(get_self(), collateral.code().raw());
   auto position_iterator = position_table.find(user.value);
   check(position_iterator != position_table.end(), "Position does not exist");

   /** Update amount_interest if position found and next_interest less then now **/
   if (position_iterator->next_interest <= current_time_point().sec_since_epoch()) {
      auto interest_interval = get_param_int(INTEREST_INT);
      asset amount_interest = asset(
         position_iterator->amount_borrowed.amount * position_iterator->interest_rate,
         position_iterator->amount_interest.symbol
      );
      position_table.modify(position_iterator, get_self(), [&](auto& row) {
         row.amount_interest += amount_interest;
         row.next_interest += interest_interval;
      });

      /** Start delayed transaction **/
      eosio::transaction out;
      out.actions.emplace_back(permission_level{get_self(), name("active")}, get_self(), name("addinterest"), std::make_tuple(user, collateral));
      out.delay_sec = interest_interval;
      uint128_t sender_id = get_deferred_tx_id(user, collateral);
      cancel_deferred(sender_id);
      out.send(sender_id, get_self(), true);

      /** Send notification to user **/
      if (is_notify) {
         send_loan_status_notification(
            user,
            position_iterator->amount_interest + position_iterator->amount_borrowed
         );
      }

      return amount_interest;
   }

   return asset();
}

void zigzag::addinterest(name user, symbol collateral) {
   /** Throw if signed by wrong account **/
   require_auth(get_self());

   zigzag::calcinterest(user, collateral, true);
}

void zigzag::liquidate(name user, symbol collateral) {
   /** Check authorization **/
   auto cron_user = get_param_string(CRON_ACCOUNT);
   check(has_auth(name(cron_user)) || has_auth(name(get_self())), "Unauthorized");

   /** Check if collateral with this symbol exists **/
   collateral_index collateral_table(get_self(), get_self().value);
   auto collateral_iterator = collateral_table.find(collateral.code().raw());
   check(collateral_iterator != collateral_table.end(), "Collateral does not exist");
   
   /** Check if user has opened position **/
   position_index position_table(get_self(), collateral_iterator->symbol.code().raw());
   auto position_iterator = position_table.find(user.value);
   check(position_iterator != position_table.end(), "User position does not exist");

   double threshold = get_param_double(LIQUIDATE_THRESHOLD);
   double penalty = get_param_double(PENALTY);
   std::string liquidate_account = get_param_string(LIQUIDATE_ACCOUNT);
   double rate = get_average_rate(collateral);

   /** Check if real need to liquidate **/
   asset amount_collateral_in_zig = convert_asset(position_iterator->amount_collateral, ZIG_SYMBOL, rate);
   asset amount_loan = position_iterator->amount_interest + position_iterator->amount_borrowed;
   double ratio = (double)amount_collateral_in_zig.amount / (double)amount_loan.amount;
   print("Threshold " + std::to_string(threshold) + '\n');
   print("Ratio " + std::to_string(ratio) + '\n');
   if (ratio > threshold) {
      return;
   }
   asset amount_to_liquidate = position_iterator->amount_collateral;
   double amount_to_return = (double)amount_collateral_in_zig.amount * (1 - penalty) - (double)amount_loan.amount;
   asset amount_collateral_to_return = asset(0, collateral);

   /** Return funds to user **/
   print("Amount to return " + std::to_string(amount_to_return) + '\n');
   if (amount_to_return > 0) {
      amount_collateral_to_return = convert_asset(asset(amount_to_return, ZIG_SYMBOL), collateral, 1 / rate);
      if (amount_collateral_to_return.amount > 0) {
         dispatch_inline(collateral_iterator->account, name("transfer"),
         PERMISSION_LEVEL,
         std::make_tuple(get_self(), user, amount_collateral_to_return, std::string("Position liquidated")));
      }
   } else {
      send_notification(user, "Position liquidated");
   }

   /** Liquidate remaining funds **/
   if ((position_iterator->amount_collateral - amount_collateral_to_return).amount > 0) {
      print("Amount to liquidate " + (position_iterator->amount_collateral - amount_collateral_to_return).to_string() + '\n');
      dispatch_inline(collateral_iterator->account, name("transfer"),
         PERMISSION_LEVEL,
         std::make_tuple(get_self(), name(liquidate_account), position_iterator->amount_collateral - amount_collateral_to_return, std::string("")));
   }

   /** Remove position **/
   position_table.erase(position_iterator);
   uint128_t sender_id = user.value;
   sender_id = (sender_id << 64) | collateral.code().raw();
   cancel_deferred(get_deferred_tx_id(user, collateral));
   print("Position closed");
}

void zigzag::transferzig(name from, name to, asset quantity, std::string memo) {

   /** Check for incoming transfer **/
   if (from == get_self() || to != get_self()) {
      return;
   }

   if (from == ZIGZAG_NAME) {
      return;
   }

   /** Fallback to default symbol if memo is not specified **/
   if (memo.length() == 0) {
      memo = std::string(DEFAULT_COLLATERAL_SYMBOL);
   }

   /** Check if collateral with this symbol exists **/
   collateral_index collateral_table(get_self(), get_self().value);
   auto collateral_iterator = collateral_table.find(symbol_code(memo).raw());
   check(collateral_iterator != collateral_table.end(), "Collateral does not exist");

   /** Check if user has opened position **/
   position_index position_table(get_self(), collateral_iterator->symbol.code().raw());
   auto position_iterator = position_table.find(from.value);
   check(position_iterator != position_table.end(), "User position does not exist");

   asset loan = position_iterator->amount_borrowed + position_iterator->amount_interest;

   /** Reject transfers below threshold if they are not closing **/
   asset threshold = asset(1000, quantity.symbol);
   check(quantity >= loan || quantity >= threshold,
      "Transfer amount is below " + threshold.to_string() + " threshold");

   /** If enought amount, close position **/
   if (quantity >= loan) {

      /** Send change **/
      asset change = quantity - loan;
      if (change.amount > 0) {
         print("Send change to user " + change.to_string() + '\n');
         dispatch_inline(
            ZIGZAG_NAME,
            name("transfer"),
            PERMISSION_LEVEL,
            std::make_tuple(get_self(), from, change, std::string(""))
         );
      }

      /** Send collateral amount **/
      print("Send collateral to user " + position_iterator->amount_collateral.to_string() + '\n');
      dispatch_inline(
         collateral_iterator->account,
         name("transfer"),
         PERMISSION_LEVEL,
         std::make_tuple(
            get_self(),
            from,
            position_iterator->amount_collateral,
            std::string("Position closed")
         )
      );

      /** Remove position **/
      position_table.erase(position_iterator);
      cancel_deferred(get_deferred_tx_id(from, collateral_iterator->symbol));
      print("Position closed");

   /** If not enought amount, update record and send notification **/
   } else {
      position_table.modify(position_iterator, get_self(), [&](auto& row) {
         auto temp_amount_interest = row.amount_interest.amount;
         row.amount_interest.amount -= row.amount_interest.amount > quantity.amount
            ? quantity.amount
            : row.amount_interest.amount;
         if (row.amount_interest.amount == 0) {
            auto remaining_amount = quantity.amount - temp_amount_interest;
            row.amount_borrowed.amount -= row.amount_borrowed.amount > remaining_amount
               ? remaining_amount
               : row.amount_borrowed.amount;
         }
      });
      send_loan_status_notification(
         from,
         position_iterator->amount_interest + position_iterator->amount_borrowed
      );
   }
}

void zigzag::loan(name from, name to, asset quantity, std::string memo) {
    /** Check for incoming transfer **/
   if (from == get_self() || to != get_self()) {
      return;
   }

   /** Reject transfers below threshold **/
   asset threshold = asset(1000, quantity.symbol);
   check(quantity >= threshold, "Transfer amount is below " + threshold.to_string() + " threshold");

   /** Check if collateral with this symbol exists **/
   collateral_index collateral(get_self(), get_self().value);
   auto collateral_iterator = collateral.find(quantity.symbol.code().raw());
   if (collateral_iterator == collateral.end() || !collateral_iterator->is_active) {
      return;
   }

   /** Calculate average exchange rate **/
   double rate = zigzag::get_average_rate(quantity.symbol);
   print("Got average rate " + std::to_string(rate) + '\n');

   /** Get "position.def" and "interest.def" from params **/
   auto position_def = get_param_double(POSITION_DEF);
   print("Got position_def " + std::to_string(position_def) + '\n');

   auto interest_def = get_param_double(INTEREST_DEF);
   print("Got interest_def " + std::to_string(interest_def) + '\n');
   
   /** Check if user has no opened position, create new empy position **/
   position_index position_table(get_self(), quantity.symbol.code().raw());
   auto position_iterator = position_table.find(from.value);
   bool existing_position = false;
   if (position_iterator == position_table.end()) {
      position_iterator = position_table.emplace(get_self(), [&](auto& row) {
         row.account = from;
         row.amount_collateral = asset(0 ,quantity.symbol);
         row.amount_borrowed = asset(0, ZIG_SYMBOL);
         row.amount_interest = asset(0, ZIG_SYMBOL); 
         row.interest_rate = interest_def;    
         row.next_interest = current_time_point().sec_since_epoch();       
      });
   } else {
      existing_position = true;
   }

   /** Get user position and update it with incoming data **/
   asset amount_borrowed_change = asset(0, ZIG_SYMBOL);
   asset to_return = asset(0, ZIG_SYMBOL);
   position_table.modify(position_iterator, get_self(), [&](auto& row) {
      row.amount_collateral += quantity;
      asset collateral_value = convert_asset(row.amount_collateral,  ZIG_SYMBOL, rate);
      collateral_value.set_amount(collateral_value.amount / position_def);
      print("Collateral value ");
      collateral_value.print();
      print('\n');

      amount_borrowed_change = collateral_value - (row.amount_borrowed + row.amount_interest);

      /** If user amount_borrowed greater than previous value, update it **/
      if (amount_borrowed_change.amount > 0) {
         row.amount_borrowed += amount_borrowed_change;  
      }
      to_return = row.amount_borrowed + row.amount_interest;
   });

   // For a new position add first interest without notification
   if (!existing_position) {
      to_return += zigzag::calcinterest(from, quantity.symbol, false);
   }

   /** Send funds if need **/
   if (amount_borrowed_change.amount > 0) {
      dispatch_inline(
         ZIGZAG_NAME,
         name("transfer"),
         PERMISSION_LEVEL,
         std::make_tuple(
            get_self(),
            from,
            amount_borrowed_change,
            get_loan_memo(to_return)
         )
      );
   }
}

/**
 * ---------------
 * Private methods
 * ---------------
 */

/** Calculate avarate exchange rate **/  
double zigzag::get_average_rate(symbol collateral) {
   rate_index rate_table(get_self(), collateral.code().raw());
   double rate = 0;
   int rate_count = 0;

   for (auto itr = rate_table.begin(); itr != rate_table.end(); itr++) {
      rate_count++;
      rate += itr->rate_to_usd;
   }
   check(rate_count != 0, "Can not find exchange rate");   
   rate /= rate_count;
   return rate;
}

/** Send loan status notification to user **/
void zigzag::send_loan_status_notification(name user, asset amount) {
   send_notification(user, get_loan_memo(amount));
}

void zigzag::send_notification(name user, std::string notification) {
   dispatch_inline(
      ZIGZAG_NAME,
      name("transfer"),
      PERMISSION_LEVEL,
      std::make_tuple(get_self(), user, NOTIFICATION_AMOUNT, notification)
   );
}

uint128_t zigzag::get_deferred_tx_id(name user, symbol collateral) {
   uint128_t sender_id = user.value;
   sender_id = (sender_id << 64) | collateral.code().raw();
   return sender_id;
}


extern "C" {
   void apply(uint64_t receiver, uint64_t code, uint64_t action) {
      print("Receiver ");
      print(name(receiver).to_string());
      print("\n");
      print("Code ");
      print(name(code).to_string());
      print("\n");
      print("Action ");
      print(name(action).to_string());
      print("\n");
   
      if (action == name("transfer").value) {
         if (code == ZIGZAG_NAME.value) {
            execute_action(name(receiver), name(code), &zigzag::transferzig);
         } else {
            execute_action(name(receiver), name(code), &zigzag::loan);
         }
      } else if (code == receiver) {
         switch (action) {
            EOSIO_DISPATCH_HELPER(zigzag, (setparam)(addcollater)(setcollater)(delcollater)(addoracle)(setoracle)(deloracle)(setrate)(setinterest)(addinterest)(liquidate))
         }
      }
   }
}
