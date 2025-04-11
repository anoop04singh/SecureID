"use client"

import { useContext } from "react"
import { WalletContext } from "@/components/wallet-provider"

export function useWallet() {
  return useContext(WalletContext)
}
