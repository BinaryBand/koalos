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


# Tests
@sp.add_test()
def test():
    # We define a test scenario, together with some outputs and checks
    # The scenario takes the module as a parameter
    scenario = sp.test_scenario("Welcome")
    scenario.h1("Welcome")

    # We first define a contract and add it to the scenario
    c1 = main.BalanceConsumer(sp.nat(0))
    scenario += c1

    # And call some of its entrypoints
    c1.receive_balance(0)
    c1.receive_balance(13)
