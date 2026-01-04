// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChessBet
 * @dev Smart contract for chess betting on BSC
 * Deploy this contract on BSC Mainnet or Testnet
 */
contract ChessBet {
    address public owner;
    uint256 public platformFee = 250; // 2.5% fee (basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    enum GameState { Waiting, Active, Finished, Cancelled }
    
    struct Game {
        address player1;
        address player2;
        uint256 stake;
        GameState state;
        address winner;
        uint256 createdAt;
    }
    
    mapping(bytes32 => Game) public games;
    mapping(address => uint256) public playerBalances;
    
    event GameCreated(bytes32 indexed gameId, address indexed player1, uint256 stake);
    event GameJoined(bytes32 indexed gameId, address indexed player2);
    event GameFinished(bytes32 indexed gameId, address indexed winner, uint256 prize);
    event GameCancelled(bytes32 indexed gameId);
    event Withdrawal(address indexed player, uint256 amount);
    event Deposit(address indexed player, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier gameExists(bytes32 gameId) {
        require(games[gameId].player1 != address(0), "Game not found");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Create a new game with a stake
     * @param gameId Unique identifier for the game
     */
    function createGame(bytes32 gameId) external payable {
        require(msg.value > 0, "Stake required");
        require(games[gameId].player1 == address(0), "Game already exists");
        
        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            stake: msg.value,
            state: GameState.Waiting,
            winner: address(0),
            createdAt: block.timestamp
        });
        
        emit GameCreated(gameId, msg.sender, msg.value);
    }
    
    /**
     * @dev Join an existing game
     * @param gameId The game to join
     */
    function joinGame(bytes32 gameId) external payable gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(game.state == GameState.Waiting, "Game not available");
        require(game.player1 != msg.sender, "Cannot join own game");
        require(msg.value == game.stake, "Stake must match");
        
        game.player2 = msg.sender;
        game.state = GameState.Active;
        
        emit GameJoined(gameId, msg.sender);
    }
    
    /**
     * @dev Finish a game and distribute prize (only owner can call - acts as oracle)
     * @param gameId The game to finish
     * @param winner The winner's address
     */
    function finishGame(bytes32 gameId, address winner) external onlyOwner gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(game.state == GameState.Active, "Game not active");
        require(winner == game.player1 || winner == game.player2, "Invalid winner");
        
        game.state = GameState.Finished;
        game.winner = winner;
        
        uint256 totalPot = game.stake * 2;
        uint256 fee = (totalPot * platformFee) / BASIS_POINTS;
        uint256 prize = totalPot - fee;
        
        // Transfer prize to winner
        playerBalances[winner] += prize;
        playerBalances[owner] += fee;
        
        emit GameFinished(gameId, winner, prize);
    }
    
    /**
     * @dev Finish game as draw - return stakes to both players
     * @param gameId The game to draw
     */
    function finishGameDraw(bytes32 gameId) external onlyOwner gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(game.state == GameState.Active, "Game not active");
        
        game.state = GameState.Finished;
        
        // Return stakes to both players
        playerBalances[game.player1] += game.stake;
        playerBalances[game.player2] += game.stake;
        
        emit GameFinished(gameId, address(0), 0);
    }
    
    /**
     * @dev Cancel a waiting game and refund player1
     * @param gameId The game to cancel
     */
    function cancelGame(bytes32 gameId) external gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(game.state == GameState.Waiting, "Game not waiting");
        require(msg.sender == game.player1 || msg.sender == owner, "Not authorized");
        
        game.state = GameState.Cancelled;
        playerBalances[game.player1] += game.stake;
        
        emit GameCancelled(gameId);
    }
    
    /**
     * @dev Deposit BNB to player balance
     */
    function deposit() external payable {
        require(msg.value > 0, "Amount required");
        playerBalances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw balance
     */
    function withdraw() external {
        uint256 balance = playerBalances[msg.sender];
        require(balance > 0, "No balance");
        
        playerBalances[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, balance);
    }
    
    /**
     * @dev Get game details
     */
    function getGame(bytes32 gameId) external view returns (
        address player1,
        address player2,
        uint256 stake,
        GameState state,
        address winner,
        uint256 createdAt
    ) {
        Game memory game = games[gameId];
        return (
            game.player1,
            game.player2,
            game.stake,
            game.state,
            game.winner,
            game.createdAt
        );
    }
    
    /**
     * @dev Update platform fee (owner only)
     */
    function setFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        platformFee = newFee;
    }
    
    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    receive() external payable {
        playerBalances[msg.sender] += msg.value;
    }
}
