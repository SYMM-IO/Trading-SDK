"use client";

import { useWalletAccount } from "@symmio/trading-react";
import { useEffect, useState } from "react";
import { isAddress, isAddressEqual, zeroAddress, type Address } from "viem";
import { TimelockFlow } from "./timelock-flow";

/** Contract reference for timelock policy and recovery. */
export function TimelockContracts() {
  const wallet = useWalletAccount();
  const [account, setAccount] = useState<Address>();
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("account");
    if (value && isAddress(value) && !isAddressEqual(value, zeroAddress)) setAccount(value);
  }, []);
  return (
    <TimelockFlow
      owner={wallet.address}
      subAccount={account}
      onSelectSubAccount={setAccount}
      ready={wallet.isConnected && wallet.isOnExpectedChain}
    />
  );
}
