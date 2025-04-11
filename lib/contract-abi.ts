// ABI for the IdentityVerifier smart contract
export const IdentityVerifierABI = [
  // Events
  "event ProofStored(string proofId, address indexed user, bool isAdult, bool livenessVerified, uint256 timestamp)",
  "event ProofVerified(string proofId, address indexed verifier, address indexed user, uint256 timestamp)",
  "event IdentityDeleted(address indexed user, uint256 timestamp)",

  // Functions
  "function storeProof(string calldata proofId, string calldata commitment, bool isAdult, bool livenessVerified, string calldata proofData, bytes32 documentHash) external",
  "function updateLivenessStatus(bool livenessVerified) external",
  "function hashAddress(address userAddress) external pure returns (bytes32)",
  "function verifyProofWithCodeHash(string calldata proofId, bytes32 addressHash, string calldata verificationCode, bytes32 codeHash) external view returns (bool)",
  "function verifyCodeHash(string calldata verificationCode, bytes32 codeHash, address userAddress) public pure returns (bool)",
  "function logVerification(string calldata proofId, bytes32 addressHash) external",
  "function getUserIdentity(address user) external view returns (string memory proofId, string memory commitment, bool isAdult, bool livenessVerified, uint256 timestamp, bool isDeleted)",
  "function getProofData(string calldata proofId) external view returns (string memory)",
  "function deleteIdentity() external",
  "function isDocumentUsed(bytes32 documentHash) external view returns (bool)",
]
