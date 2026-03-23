import { parseAbiItem } from "viem";

export const poolKeyAbi = {
  name: "poolKey",
  type: "tuple",
  components: [
    { name: "currency0", type: "address" },
    { name: "currency1", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" }
  ]
} as const;

export const pariHookKeeperAbi = [
  {
    type: "function",
    name: "currentWindowId",
    stateMutability: "view",
    inputs: [poolKeyAbi],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "gridConfigs",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "pythPriceFeedId", type: "bytes32" },
      { name: "bandWidth", type: "uint256" },
      { name: "windowDuration", type: "uint256" },
      { name: "frozenWindows", type: "uint256" },
      { name: "maxStakePerCell", type: "uint256" },
      { name: "feeBps", type: "uint256" },
      { name: "gridEpoch", type: "uint256" },
      { name: "usdcToken", type: "address" },
      { name: "minPoolThreshold", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "getWindow",
    stateMutability: "view",
    inputs: [poolKeyAbi, { name: "windowId", type: "uint256" }],
    outputs: [
      { name: "totalPool", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "voided", type: "bool" },
      { name: "unresolved", type: "bool" },
      { name: "winningCell", type: "uint256" },
      { name: "redemptionRate", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "placeBet",
    stateMutability: "nonpayable",
    inputs: [poolKeyAbi, { name: "cellId", type: "uint256" }, { name: "windowId", type: "uint256" }, { name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "seedWindow",
    stateMutability: "nonpayable",
    inputs: [poolKeyAbi, { name: "cellId", type: "uint256" }, { name: "windowId", type: "uint256" }, { name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "payable",
    inputs: [poolKeyAbi, { name: "windowId", type: "uint256" }, { name: "pythUpdateData", type: "bytes" }],
    outputs: []
  },
  {
    type: "function",
    name: "finalizeUnresolved",
    stateMutability: "nonpayable",
    inputs: [poolKeyAbi, { name: "windowId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "getUnresolvedWindows",
    stateMutability: "view",
    inputs: [poolKeyAbi],
    outputs: [{ name: "", type: "uint256[]" }]
  },
  {
    type: "function",
    name: "pushPayouts",
    stateMutability: "nonpayable",
    inputs: [poolKeyAbi, { name: "windowId", type: "uint256" }, { name: "winners", type: "address[]" }],
    outputs: []
  }
] as const;

export const betPlacedEvent = parseAbiItem(
  "event BetPlaced(bytes32 indexed poolId, uint256 indexed windowId, uint256 indexed cellId, address bettor, uint256 amount)"
);

export const payoutPushedEvent = parseAbiItem(
  "event PayoutPushed(bytes32 indexed poolId, uint256 indexed windowId, address indexed winner, uint256 amount)"
);

export const pythFeeAbi = [
  {
    type: "function",
    name: "getUpdateFee",
    stateMutability: "view",
    inputs: [{ name: "updateData", type: "bytes[]" }],
    outputs: [{ name: "feeAmount", type: "uint256" }]
  }
] as const;
