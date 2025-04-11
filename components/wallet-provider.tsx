"use client"

import type React from "react"
import { createContext, useEffect, useState } from "react"
import { ethers } from "ethers"

type WalletContextType = {
  provider: ethers.BrowserProvider | null
  signer: ethers.JsonRpcSigner | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

export const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // Initialize provider if window is defined
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Improved detection for MetaMask and other providers
      const detectProvider = () => {
        // Check for different wallet providers with improved detection
        if (window.ethereum) {
          console.log("Found window.ethereum provider")
          return window.ethereum
        }

        // Check for MetaMask specifically
        if ((window as any).ethereum?.isMetaMask) {
          console.log("Found MetaMask provider")
          return (window as any).ethereum
        }

        // Check for legacy web3 provider
        if ((window as any).web3?.currentProvider) {
          console.log("Found legacy web3 provider")
          return (window as any).web3.currentProvider
        }

        // Check for Android-specific detection
        if (navigator.userAgent.includes("Android") && (window as any).ethereum) {
          console.log("Found Android-specific provider")
          return (window as any).ethereum
        }

        console.log("No Ethereum provider found")
        return null
      }

      const ethereum = detectProvider()

      if (ethereum) {
        try {
          // Create a provider with a timeout to avoid hanging
          const provider = new ethers.BrowserProvider(ethereum, undefined, { timeout: 5000 })
          setProvider(provider)

          // Check if already connected
          const checkConnection = async () => {
            try {
              const accounts = await ethereum.request({ method: "eth_accounts" })
              if (accounts && accounts.length > 0) {
                const signer = await provider.getSigner()
                const network = await provider.getNetwork()

                setAddress(accounts[0])
                setChainId(Number(network.chainId))
                setSigner(signer)
                setIsConnected(true)
                console.log("Wallet already connected:", accounts[0])
              }
            } catch (error) {
              console.error("Failed to check connection:", error)
            }
          }

          checkConnection()
        } catch (error) {
          console.error("Error initializing provider:", error)
        }
      } else {
        console.log("No Ethereum provider found. Please install MetaMask or another wallet.")
      }
    }
  }, [])

  // Connect wallet
  const connect = async () => {
    if (isConnecting) return // Prevent multiple connection attempts

    console.log("Attempting to connect wallet...")
    setIsConnecting(true)

    try {
      // Improved detection for MetaMask and other providers
      const detectProvider = () => {
        // Check for different wallet providers with improved detection
        if (window.ethereum) {
          console.log("Found window.ethereum provider")
          return window.ethereum
        }

        // Check for MetaMask specifically
        if ((window as any).ethereum?.isMetaMask) {
          console.log("Found MetaMask provider")
          return (window as any).ethereum
        }

        // Check for legacy web3 provider
        if ((window as any).web3?.currentProvider) {
          console.log("Found legacy web3 provider")
          return (window as any).web3.currentProvider
        }

        // Check for Android-specific detection
        if (navigator.userAgent.includes("Android") && (window as any).ethereum) {
          console.log("Found Android-specific provider")
          return (window as any).ethereum
        }

        console.log("No Ethereum provider found")
        return null
      }

      const ethereum = detectProvider()

      if (!ethereum) {
        console.error("No Ethereum provider found")
        alert("No Ethereum wallet detected. Please install MetaMask or another wallet.")
        return
      }

      console.log("Ethereum provider found:", ethereum)

      // Request accounts directly from the provider
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      })

      console.log("Accounts received:", accounts)

      if (accounts && accounts.length > 0) {
        // Create provider and signer
        const provider = new ethers.BrowserProvider(ethereum)
        setProvider(provider)

        const signer = await provider.getSigner()
        const network = await provider.getNetwork()

        setAddress(accounts[0])
        setChainId(Number(network.chainId))
        setSigner(signer)
        setIsConnected(true)

        console.log("Wallet connected successfully:", accounts[0])

        // Check if we're on Sepolia (chainId 11155111)
        if (Number(network.chainId) !== 11155111) {
          try {
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0xaa36a7" }], // Sepolia chainId in hex
            })
          } catch (error: any) {
            console.error("Error switching chain:", error)
            // If the chain is not added, add it
            if (error.code === 4902) {
              try {
                await ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: "0xaa36a7",
                      chainName: "Sepolia Testnet",
                      nativeCurrency: {
                        name: "Sepolia ETH",
                        symbol: "ETH",
                        decimals: 18,
                      },
                      rpcUrls: ["https://rpc.sepolia.org"],
                      blockExplorerUrls: ["https://sepolia.etherscan.io"],
                    },
                  ],
                })
              } catch (addError) {
                console.error("Error adding chain:", addError)
              }
            }
          }
        }
      } else {
        console.error("No accounts returned from wallet")
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      alert("Failed to connect wallet. Please try again.")
    } finally {
      setIsConnecting(false)
    }
  }

  // Disconnect wallet
  const disconnect = () => {
    setSigner(null)
    setAddress(null)
    setChainId(null)
    setIsConnected(false)
    console.log("Wallet disconnected")
  }

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ethereum = window.ethereum || (window as any).web3?.currentProvider || (window as any).ethereum

      if (ethereum) {
        const handleAccountsChanged = (accounts: string[]) => {
          console.log("Accounts changed:", accounts)
          if (accounts.length === 0) {
            disconnect()
          } else if (isConnected) {
            setAddress(accounts[0])
          }
        }

        const handleChainChanged = (chainId: string) => {
          console.log("Chain changed:", chainId)
          window.location.reload()
        }

        const handleConnect = (connectInfo: { chainId: string }) => {
          console.log("Wallet connected event:", connectInfo)
        }

        const handleDisconnect = (error: { code: number; message: string }) => {
          console.log("Wallet disconnected event:", error)
          disconnect()
        }

        // Add event listeners
        if (ethereum.on) {
          ethereum.on("accountsChanged", handleAccountsChanged)
          ethereum.on("chainChanged", handleChainChanged)
          ethereum.on("connect", handleConnect)
          ethereum.on("disconnect", handleDisconnect)

          // Return cleanup function
          return () => {
            if (ethereum.removeListener) {
              ethereum.removeListener("accountsChanged", handleAccountsChanged)
              ethereum.removeListener("chainChanged", handleChainChanged)
              ethereum.removeListener("connect", handleConnect)
              ethereum.removeListener("disconnect", handleDisconnect)
            }
          }
        }
      }
    }
  }, [isConnected])

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId,
        isConnected,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}
