// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChessBetV2
 * @dev Smart contract for chess betting on BSC with BNB and USDT (BEP-20) support
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

contract ChessBetV2 {
    address public owner;
    uint256 public platformFee = 250; // 2.5% fee (basis points)
    uint256 public constant BASIS_POINTS = 10000;

    // USDT BEP-20 on BSC Mainnet
    address public usdtToken = 0x55d398326f99059fF775485246999027B3197955;

    enum GameState { Waiting, Active, Finished, Cancelled }

    struct Game {
        address player1;
        address player2;
        uint256 stake;
        GameState state;
        address winner;
        uint256 createdAt;
        bool isToken; // false = BNB, true = USDT
    }

    mapping(bytes32 => Game) public games;
    mapping(address => uint256) public playerBalances;      // BNB balances
    mapping(address => uint256) public playerTokenBalances;  // USDT balances

    event GameCreated(bytes32 indexed gameId, address indexed player1, uint256 stake, bool isToken);
    event GameJoined(bytes32 indexed gameId, address indexed player2);
    event GameFinished(bytes32 indexed gameId, address indexed winner, uint256 prize);
    event GameCancelled(bytes32 indexed gameId);
    event Withdrawal(address indexed player, uint256 amount, bool isToken);
    event Deposit(address indexed player, uint256 amount, bool isToken);

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
     * @dev Set USDT token address (for testnet deployment)
     */
    function setUsdtToken(address _usdtToken) external onlyOwner {
        require(_usdtToken != address(0), "Invalid address");
        usdtToken = _usdtToken;
    }

    /**
     * @dev Create a new game with BNB stake
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
            createdAt: block.timestamp,
            isToken: false
        });

        emit GameCreated(gameId, msg.sender, msg.value, false);
    }

    /**
     * @dev Create a new game with USDT stake
     */
    function createGameToken(bytes32 gameId, uint256 amount) external {
        require(amount > 0, "Stake required");
        require(games[gameId].player1 == address(0), "Game already exists");

        IERC20 token = IERC20(usdtToken);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            stake: amount,
            state: GameState.Waiting,
            winner: address(0),
            createdAt: block.timestamp,
            isToken: true
        });

        emit GameCreated(gameId, msg.sender, amount, true);
    }

    /**
     * @dev Join an existing game (BNB)
     */
    function joinGame(bytes32 gameId) external payable gameExists(gameId) {
        Game storage game = games[gameId];

        require(game.state == GameState.Waiting, "Game not available");
        require(game.player1 != msg.sender, "Cannot join own game");
        require(!game.isToken, "Game requires token payment");
        require(msg.value == game.stake, "Stake must match");

        game.player2 = msg.sender;
        game.state = GameState.Active;

        emit GameJoined(gameId, msg.sender);
    }

    /**
     * @dev Join an existing game (USDT)
     */
    function joinGameToken(bytes32 gameId) external gameExists(gameId) {
        Game storage game = games[gameId];

        require(game.state == GameState.Waiting, "Game not available");
        require(game.player1 != msg.sender, "Cannot join own game");
        require(game.isToken, "Game requires BNB payment");

        IERC20 token = IERC20(usdtToken);
        require(token.transferFrom(msg.sender, address(this), game.stake), "Transfer failed");

        game.player2 = msg.sender;
        game.state = GameState.Active;

        emit GameJoined(gameId, msg.sender);
    }

    /**
     * @dev Finish a game and distribute prize (only owner - acts as oracle)
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

        if (game.isToken) {
            playerTokenBalances[winner] += prize;
            playerTokenBalances[owner] += fee;
        } else {
            playerBalances[winner] += prize;
            playerBalances[owner] += fee;
        }

        emit GameFinished(gameId, winner, prize);
    }

    /**
     * @dev Finish game as draw
     */
    function finishGameDraw(bytes32 gameId) external onlyOwner gameExists(gameId) {
        Game storage game = games[gameId];

        require(game.state == GameState.Active, "Game not active");

        game.state = GameState.Finished;

        if (game.isToken) {
            playerTokenBalances[game.player1] += game.stake;
            playerTokenBalances[game.player2] += game.stake;
        } else {
            playerBalances[game.player1] += game.stake;
            playerBalances[game.player2] += game.stake;
        }

        emit GameFinished(gameId, address(0), 0);
    }

    /**
     * @dev Cancel a waiting game and refund
     */
    function cancelGame(bytes32 gameId) external gameExists(gameId) {
        Game storage game = games[gameId];

        require(game.state == GameState.Waiting, "Game not waiting");
        require(msg.sender == game.player1 || msg.sender == owner, "Not authorized");

        game.state = GameState.Cancelled;

        if (game.isToken) {
            playerTokenBalances[game.player1] += game.stake;
        } else {
            playerBalances[game.player1] += game.stake;
        }

        emit GameCancelled(gameId);
    }

    /**
     * @dev Deposit BNB
     */
    function deposit() external payable {
        require(msg.value > 0, "Amount required");
        playerBalances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value, false);
    }

    /**
     * @dev Deposit USDT
     */
    function depositToken(uint256 amount) external {
        require(amount > 0, "Amount required");
        IERC20 token = IERC20(usdtToken);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        playerTokenBalances[msg.sender] += amount;
        emit Deposit(msg.sender, amount, true);
    }

    /**
     * @dev Withdraw BNB balance
     */
    function withdraw() external {
        uint256 balance = playerBalances[msg.sender];
        require(balance > 0, "No balance");

        playerBalances[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender, balance, false);
    }

    /**
     * @dev Withdraw USDT balance
     */
    function withdrawToken() external {
        uint256 balance = playerTokenBalances[msg.sender];
        require(balance > 0, "No balance");

        playerTokenBalances[msg.sender] = 0;

        IERC20 token = IERC20(usdtToken);
        require(token.transfer(msg.sender, balance), "Transfer failed");

        emit Withdrawal(msg.sender, balance, true);
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
        uint256 createdAt,
        bool isToken
    ) {
        Game memory game = games[gameId];
        return (
            game.player1,
            game.player2,
            game.stake,
            game.state,
            game.winner,
            game.createdAt,
            game.isToken
        );
    }

    function setFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high");
        platformFee = newFee;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    receive() external payable {
        playerBalances[msg.sender] += msg.value;
    }
}
