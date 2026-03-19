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
  }
] as const;
