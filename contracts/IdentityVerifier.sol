// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract IdentityVerifier {
   struct Identity {
       string proofId;
       string commitment;
       bool isAdult;
       bool livenessVerified;
       uint256 timestamp;
       bool isDeleted;
   }
   
   // Mapping from user address to their identity
   mapping(address => Identity) private userIdentities;
   
   // Mapping from proofId to proof data
   mapping(string => string) private proofData;
   
   // Mapping from document hash to boolean (used to prevent document reuse)
   mapping(bytes32 => bool) private documentHashes;
   
   // Mapping from address hash to address (used for QR code verification)
   mapping(bytes32 => address) private addressHashes;
   
   // Events
   event ProofStored(string proofId, address indexed user, bool isAdult, bool livenessVerified, uint256 timestamp);
   event ProofVerified(string proofId, address indexed verifier, address indexed user, uint256 timestamp);
   event IdentityDeleted(address indexed user, uint256 timestamp);
   
   /**
    * @dev Store a new identity proof
    * @param proofId Unique identifier for the proof
    * @param commitment Cryptographic commitment to the identity data
    * @param isAdult Boolean indicating if the user is over 18
    * @param livenessVerified Boolean indicating if liveness was verified
    * @param proofDataStr Stringified ZK proof data
    * @param documentHash Hash of the document used to create the identity
    */
   function storeProof(
       string calldata proofId,
       string calldata commitment,
       bool isAdult,
       bool livenessVerified,
       string calldata proofDataStr,
       bytes32 documentHash
   ) external {
       // Ensure the proof ID is not empty
       require(bytes(proofId).length > 0, "Proof ID cannot be empty");
       
       // Ensure user doesn't already have an active identity
       require(bytes(userIdentities[msg.sender].proofId).length == 0 || 
               userIdentities[msg.sender].isDeleted, 
               "User already has an active identity");
       
       // Ensure document hasn't been used before
       require(!documentHashes[documentHash], "This document has already been used to create an identity");
       
       // Store the identity
       userIdentities[msg.sender] = Identity({
           proofId: proofId,
           commitment: commitment,
           isAdult: isAdult,
           livenessVerified: livenessVerified,
           timestamp: block.timestamp,
           isDeleted: false
       });
       
       // Store the proof data
       proofData[proofId] = proofDataStr;
       
       // Mark document as used
       documentHashes[documentHash] = true;
       
       // Store address hash for QR verification
       bytes32 addressHash = keccak256(abi.encodePacked(msg.sender));
       addressHashes[addressHash] = msg.sender;
       
       // Emit event
       emit ProofStored(proofId, msg.sender, isAdult, livenessVerified, block.timestamp);
   }
   
   /**
    * @dev Update liveness verification status
    * @param livenessVerified New liveness verification status
    */
   function updateLivenessStatus(bool livenessVerified) external {
       // Ensure the user has an identity
       require(bytes(userIdentities[msg.sender].proofId).length > 0, "No identity found for this user");
       require(!userIdentities[msg.sender].isDeleted, "Identity has been deleted");
       
       // Update liveness status
       userIdentities[msg.sender].livenessVerified = livenessVerified;
       
       // Update proof data to include liveness verification
       string memory proofId = userIdentities[msg.sender].proofId;
       string memory proofDataStr = proofData[proofId];
       
       // In a real implementation, we would update the ZK proof data here
       // For this demo, we'll just append the liveness status
       proofData[proofId] = string(abi.encodePacked(proofDataStr, ", \"livenessVerified\": ", livenessVerified ? "true" : "false"));
       
       // Emit event
       emit ProofStored(proofId, msg.sender, userIdentities[msg.sender].isAdult, livenessVerified, block.timestamp);
   }
   
   /**
    * @dev Hash an address for QR code
    * @param userAddress The address to hash
    * @return bytes32 The hashed address
    */
   function hashAddress(address userAddress) external pure returns (bytes32) {
       return keccak256(abi.encodePacked(userAddress));
   }
   
   /**
    * @dev Get address from hash
    * @param addressHash The hashed address
    * @return address The original address
    */
   function getAddressFromHash(bytes32 addressHash) private view returns (address) {
       address userAddress = addressHashes[addressHash];
       require(userAddress != address(0), "Invalid address hash");
       return userAddress;
   }
   
   /**
    * @dev Verify a code hash
    * @param verificationCode The verification code
    * @param codeHash The hash of the code with the user's address
    * @param userAddress The user's address
    * @return bool True if the hash is valid
    */
   function verifyCodeHash(string calldata verificationCode, bytes32 codeHash, address userAddress) public pure returns (bool) {
       bytes32 computedHash = keccak256(abi.encodePacked(verificationCode, ":", userAddress));
       return computedHash == codeHash;
   }
   
   /**
    * @dev Verify an identity proof using code hash
    * @param proofId The proof ID to verify
    * @param addressHash The hashed address from the QR code
    * @param verificationCode The verification code provided by the user
    * @param codeHash The hash of the verification code with the user's address
    * @return bool True if the proof is valid
    */
   function verifyProofWithCodeHash(
       string calldata proofId, 
       bytes32 addressHash, 
       string calldata verificationCode,
       bytes32 codeHash
   ) external view returns (bool) {
       // Get the user's address from the address hash
       address userAddress = getAddressFromHash(addressHash);
       
       // Get the user's identity
       Identity memory identity = userIdentities[userAddress];
       
       // Check if the identity exists and is not deleted
       require(bytes(identity.proofId).length > 0, "No identity found for this user");
       require(!identity.isDeleted, "Identity has been deleted");
       
       // Check if the proof IDs match
       bool proofMatches = keccak256(bytes(identity.proofId)) == keccak256(bytes(proofId));
       
       // Verify the code hash
       bool codeValid = verifyCodeHash(verificationCode, codeHash, userAddress);
       
       // In a real implementation, we would verify the ZK proof here
       
       return proofMatches && codeValid;
   }
   
   /**
    * @dev Verify an identity proof using only address hash (less secure)
    * @param proofId The proof ID to verify
    * @param addressHash The hashed address from the QR code
    * @return bool True if the proof is valid
    */
   function verifyProof(
       string calldata proofId, 
       bytes32 addressHash
   ) external view returns (bool) {
       // Get the user's address from the address hash
       address userAddress = getAddressFromHash(addressHash);
       
       // Get the user's identity
       Identity memory identity = userIdentities[userAddress];
       
       // Check if the identity exists and is not deleted
       require(bytes(identity.proofId).length > 0, "No identity found for this user");
       require(!identity.isDeleted, "Identity has been deleted");
       
       // Check if the proof IDs match
       bool isValid = keccak256(bytes(identity.proofId)) == keccak256(bytes(proofId));
       
       // In a real implementation, we would verify the ZK proof here
       
       return isValid;
   }
   
   /**
    * @dev Log verification event (optional, can be called after verification if event logging is needed)
    * @param proofId The proof ID that was verified
    * @param addressHash The hashed address from the QR code
    */
   function logVerification(string calldata proofId, bytes32 addressHash) external {
       // Get the user's address from the address hash
       address userAddress = getAddressFromHash(addressHash);
       
       // Log the verification
       emit ProofVerified(proofId, msg.sender, userAddress, block.timestamp);
   }
   
   /**
    * @dev Get a user's identity
    * @param user The address of the user
    * @return Identity data
    */
   function getUserIdentity(address user) external view returns (
       string memory proofId,
       string memory commitment,
       bool isAdult,
       bool livenessVerified,
       uint256 timestamp,
       bool isDeleted
   ) {
       Identity memory identity = userIdentities[user];
       return (
           identity.proofId,
           identity.commitment,
           identity.isAdult,
           identity.livenessVerified,
           identity.timestamp,
           identity.isDeleted
       );
   }
   
   /**
    * @dev Get proof data for a specific proof ID
    * @param proofId The proof ID
    * @return string The proof data
    */
   function getProofData(string calldata proofId) external view returns (string memory) {
       return proofData[proofId];
   }
   
   /**
    * @dev Delete a user's identity
    */
   function deleteIdentity() external {
       // Ensure the user has an identity
       require(bytes(userIdentities[msg.sender].proofId).length > 0, "No identity found for this user");
       require(!userIdentities[msg.sender].isDeleted, "Identity already deleted");
       
       // Mark the identity as deleted
       userIdentities[msg.sender].isDeleted = true;
       
       // Note: We don't remove the document hash from documentHashes
       // This ensures the document can't be reused even after deletion
       
       // Emit event
       emit IdentityDeleted(msg.sender, block.timestamp);
   }
   
   /**
    * @dev Check if a document has been used before
    * @param documentHash The hash of the document
    * @return bool True if the document has been used
    */
   function isDocumentUsed(bytes32 documentHash) external view returns (bool) {
       return documentHashes[documentHash];
   }
}
