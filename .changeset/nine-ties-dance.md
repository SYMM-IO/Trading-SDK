---
"@symmio/trading-react": minor
"@symmio/trading-core": minor
---

@symmio/trading-core

New account - layer API for registering an affiliate on - chain:

- requestToRegisterAffiliate — submit registration request(creates PENDING affiliate)
  - cancelRegistration — cancel a pending registration
    - getAffiliateState — read affiliate status(PENDING / ACTIVE / …)
      - generateAccountManagerAddress — derive account - manager address
        - simulate \* variants for each write, query - option factories, and types — all exported from the package barrel

Doc / error improvements(no behavior change):

- AFFILIATE_ADDRESS_REQUIRED message rewritten — states zero address is valid no - affiliate placeholder(trades open, no
  fee share) and links registration page - depositForAccount JSDoc — instant flow funds via deposit alone(available balance); depositAndAllocateForAccount is
  classic - pool only

@symmio/trading-react

    - New hooks wrapping the above: useRequestToRegisterAffiliate, useCancelRegistration, useAffiliateState,
        useGeneratedAccountManagerAddress
        - useDepositAndAllocate JSDoc clarified: allocates to classic pool; instant flow uses useDeposit alone
            - New hook tests: error - codes, locked - params, notional - cap(internal, no API change)
