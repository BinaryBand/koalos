import smartpy as sp


# A SmartPy module
@sp.module
def main():
    # A class of contracts
    class BalanceConsumer(sp.Contract):
        def __init__(self, balance):
            self.data.balance = balance

        @sp.entrypoint
        def receive_balance(self, params):
            self.data.balance = params

        @sp.onchain_view
        def get_value_consumer(self, parm: sp.nat) -> sp.nat:
            return self.data.balance

    class FA12Token(sp.Contract):
        def __init__(self, total_supply: sp.nat):
            self.data.total_supply = total_supply
            self.data.ledger = sp.cast(
                sp.big_map(),
                sp.big_map[sp.address, sp.nat],
            )

        @sp.entrypoint
        def mint(self, param: sp.record(address=sp.address, value=sp.nat)):
            balance_from = self.data.ledger.get(param.address, default=sp.nat(0))
            balance_from += param.value
            self.data.ledger[param.address] = balance_from

        @sp.entrypoint
        def transfer(self, param: sp.record(from_=sp.address, to_=sp.address, value=sp.nat)):
            balance_from = self.data.ledger.get(param.from_, default=sp.nat(0))
            balance_to = self.data.ledger.get(param.to_, default=sp.nat(0))

            self.data.ledger[param.from_] = sp.as_nat(balance_from - param.value, error="FA1.2_InsufficientBalance")
            self.data.ledger[param.to_] = balance_to + param.value

        @sp.entrypoint
        def getBalance(self, param):
            (address, callback) = param
            result = self.data.ledger.get(address, default=sp.nat(0))
            sp.transfer(result, sp.tez(0), callback)

        @sp.onchain_view
        def get_value(self) -> sp.nat:
            # (contract, address) = param
            # return sp.nat(121)
            x = sp.view(
                "get_value_consumer",
                sp.address('KT1TezoooozzSmartPyzzSTATiCzzzwwBFA1'),
                sp.nat(2),
                sp.nat
            )
            return x.unwrap_some()


# Tests
@sp.add_test()
def test():
    # We define a test scenario, together with some outputs and checks
    # The scenario takes the module as a parameter
    scenario = sp.test_scenario("Virtual Wallet")
    scenario.h1("Welcome")

    # We first define a contract and add it to the scenario
    params = sp.nat(420)
    c1 = main.BalanceConsumer(params)
    scenario += c1

    # Define test accounts
    alice = sp.test_account("Alice")
    bob = sp.test_account("Bob")

    # Deploy a mock FA1.2 token contract
    initial_supply = sp.nat(1000)
    token = main.FA12Token(initial_supply)
    scenario += token

    scenario.h1("Init Ledger")
    token.mint(address=alice.address, value=sp.nat(700))
    token.mint(address=bob.address, value=sp.nat(300))
    ledger = token.data.ledger
    scenario.show(ledger)

    scenario.h1("Post Transfer Ledger")
    token.transfer(from_=alice.address, to_=bob.address, value=sp.nat(123))
    scenario.show(ledger)

    x = sp.view("get_value", token.address, sp.unit, sp.nat)
    scenario.show(x)