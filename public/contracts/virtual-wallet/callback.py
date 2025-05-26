import smartpy as sp

# sample fa2 token to run test
FA2 = sp.io.import_script_from_url("https://smartpy.io/templates/fa2_lib.py")
class SingleAssetToken(
    FA2.OnchainviewBalanceOf,
    FA2.Fa2SingleAsset
):
    def __init__(self, **kwargs):
        FA2.Fa2SingleAsset.__init__(self, **kwargs)


class ContractA(sp.Contract):
    def __init__(self, value):
        self.init(updated_balance = value)

    @sp.entry_point
    def getBalance(self, contract_address):
        fa2_contract = sp.contract(
            sp.TRecord(
                # sp.TRecord instead of sp.TNat, should be same as defined below in sp.set_type
                callback=sp.TContract(sp.TList(sp.TRecord(
                    balance = sp.TNat,
                    request = sp.TRecord(
                        owner = sp.TAddress,
                        token_id = sp.TNat
                    ).layout(("owner", "token_id"))
                ).layout(("request", "balance")))),
                requests=sp.TList(
                    sp.TRecord(
                        owner=sp.TAddress,
                        token_id=sp.TNat,
                    ).layout(("owner", "token_id"))
                ),
            # flipping the layout from .layout(("callback", "requests"))
            ).layout(("requests", "callback"))
        , contract_address, entry_point="balance_of").open_some()
        x  = sp.transfer(
            sp.record(
                callback=sp.self_entry_point("test_balance"), 
                requests=[sp.record(
                    owner=sp.address("tz1dhsUB43VJ58FndJrCvS6FpGb1pHi5hijN"),
                    # getting token_id 0 because here we have a single token
                    token_id=0)]
            ),
            sp.tez(0),
            fa2_contract
        )

    @sp.entry_point
    def test_balance(self, balance):
        # sp.TRecord instead of sp.TPair
        sp.set_type(balance, sp.TList(sp.TRecord(
            balance = sp.TNat,
            request = sp.TRecord(
                owner = sp.TAddress,
                token_id = sp.TNat
            ).layout(("owner", "token_id"))
        ).layout(("request", "balance"))))
        # return list has only one element, so saving the head
        with sp.match_cons(balance) as x:
            self.data.updated_balance = x.head.balance

if "templates" not in __name__:
    @sp.add_test(name = "StoreValue")
    def test():
        c1 = ContractA(sp.nat(12))
        scenario = sp.test_scenario()
        scenario.h1("Store Value")
        scenario += c1
        # creating admin account to make testing transactions
        admin = sp.test_account('admin')

        # registering sample fa2 contract
        fa2 = SingleAssetToken(
            metadata = sp.utils.metadata_of_url('ipfs://example'),
            token_metadata = sp.map({'': sp.utils.bytes_of_string('ipfs://example')})
        )
        scenario += fa2

        # getting the balance
        c1.getBalance(fa2.address).run(sender=admin)