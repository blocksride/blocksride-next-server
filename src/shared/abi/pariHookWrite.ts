export const pariHookWriteAbi = [
  {
    type: "function",
    name: "placeBetWithSig",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ]
      },
      { name: "cellId", type: "uint256" },
      { name: "windowId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "user", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "sig", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "claimAllFor",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ]
      },
      { name: "windowIds", type: "uint256[]" },
      { name: "user", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" }
    ],
    outputs: []
  }
] as const;
