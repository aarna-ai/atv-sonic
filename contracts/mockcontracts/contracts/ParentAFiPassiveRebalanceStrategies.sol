// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import {SafeERC20} from "./Interfaces/SafeERC20.sol";
import {OwnableDelayModule} from "./Interfaces/OwnableDelayModule.sol";
import "./Interfaces/IERC20.sol";
import {ISwapRouter} from "./Interfaces/ISwapRouter.sol";
import "./Interfaces/IUniswapV3Factory.sol";
import "./Libraries/ArrayUtils.sol";
import {IAFiStorage} from "./Interfaces/IAFiStorage.sol";

interface IAFiManager {
  function getUTokenProportion(
    address aFiContract,
    address aFiStorage
  ) external returns (uint256[] memory, uint256);

  function rebalanceController() external view returns (address);
}

interface IAFi {
  function sendProfitOrFeeToManager(
    address wallet,
    uint profitShare,
    address oToken
  ) external;
}

interface IUniswapOracleV3 {
  function getTotalProfit() external view returns (uint256);

  function getDaoProfit() external view returns (uint256);
}

contract ParentAFiPassiveRebalanceStrategies is OwnableDelayModule {
  using SafeERC20 for IERC20;
  using ArrayUtils for uint[];
  using ArrayUtils for address[];
  address public afiManager;
  address public afiStorage;
  address public aFiOracle;
  bool internal paused;

  struct StablePools {
    address[] _pools;
  }

  struct UniPoolData {
    address[] _underlyingTokens; //uTokens
    address[] _underlyingUniPoolToken; //uToken - MiddleToken
    address[] _underlyingUniPool; //uToken - Middle Token Pool
    address[] _underlyingPoolWithWETH; //uToken pool with WETH
    StablePools[] stablePools; //Stable - Middle pool
    address[] stableWethPool; //Stalbe - WETH Token
  }

  mapping(address => uint) internal strategyNumber;
  mapping(address => mapping(address => address)) internal tokenUniPool;
  mapping(address => address) internal priceOracles;

  uint24 internal _uniFee = 3000;

  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  /**
   * @param account Address of the account that paused the contract.
   */
  event Paused(address account);
  /**
   * @param account Address of the account that unpaused the contract.
   */
  event Unpaused(address account);
  event UpdateRebalStrategyNumberByOwner(
    address indexed aFiContract,
    uint updatedStrategy
  );

  modifier contractUnpaused() {
    require(!paused, "AFP02");
    _;
  }

  modifier contractPaused() {
    require(paused, "AFP03");
    _;
  }

  modifier onlySpecificAddress(address _addr) {
    require(msg.sender == _addr, "AFPR: Not authorized"); //solhint-disable-line reason-string
    _;
  }

  /**
   * @notice To pause the contract.
   * @dev Requirements: It can only be invoked by owner.
   */
  function pause() external contractUnpaused onlyOwner {
    paused = true;
    emit Paused(msg.sender);
  }

  /**
   * @notice To resume/unpause the contract.
   * @dev Requirements: It can only be invoked by the owner.
   */
  function unPause() external contractPaused onlyOwner {
    paused = false;
    emit Unpaused(msg.sender);
  }

  /**
   * @notice Returns a new proportions according to the strategy
   * @param _aFiContract AFi Contract.
   * @param _aFiManager AFi Manager.
   * @param _aFiStorage AFi Storage.
   * @param _tokens underlying tokens.
   * @return proportions i.e. a new proportions array according to the strategy.
   */
  function applyRebalForProportions(
    address _aFiContract,
    address _aFiManager,
    address _aFiStorage,
    address[] memory _tokens,
    uint256 strategy
  )
    external
    contractUnpaused
    onlySpecificAddress(_aFiContract)
    returns (uint[] memory proportions, uint256 totalProp)
  {
    uint[] memory uTokenProportions = new uint[](_tokens.length);
    if (strategy == 1) {
      (uTokenProportions, totalProp) = IAFiManager(_aFiManager).getUTokenProportion(
        _aFiContract,
        _aFiStorage
      );
    }
    return (uTokenProportions, totalProp);
  }

  /**
   * @notice Returns the pause status of the contract.
   * @return bool pause status of the contract.
   */
  function getPauseStatus() external view returns (bool) {
    return paused;
  }

  /**
   * @notice Returns current enabled strategy for passive rebalance.
   * @param aFiContract afi Contract.
   * @return uint strategy number.
   */
  function getRebalStrategyNumber(address aFiContract) external view returns (uint) {
    return strategyNumber[aFiContract];
  }

  /**
   * @notice Updates the current enabled strategy for passive rebalance for an afi contract.
   * @dev The contract must not be paused. It can only be invoked by owner of the contract.
   * @param aFiContract afi Contract.
   * @param updatedStrategy uint new strategy numebr to update.
   */
  function updateRebalStrategyNumberByOwner(
    address aFiContract,
    uint updatedStrategy
  ) external contractUnpaused onlyOwner {
    strategyNumber[aFiContract] = updatedStrategy;
    emit UpdateRebalStrategyNumberByOwner(aFiContract, updatedStrategy);
  }

  /**
   * @notice Sets the address of the AFiStorage contract.
   * @dev Only the owner of the contract can invoke this function.
   * @param _afiStorage The address of the AFiStorage contract.
   */
  function setStorage(address _afiStorage) external onlyOwner {
    require(_afiStorage != address(0), "AFP04");
    afiStorage = _afiStorage;
  }

  /**
   * @notice Sets the address of the AFiManager contract.
   * @dev Only the owner of the contract can invoke this function.
   * @param _aFiManager The address of the AFiManager contract.
   */
  function setManager(address _aFiManager) external onlyOwner {
    require(_aFiManager != address(0), "AFP05");
    afiManager = _aFiManager;
  }

  /**
   * @notice Retrieves the UniSwap pool address for a given pair of tokens.
   * @param tok The address of the first token in the pair.
   * @param midTok The address of the second token in the pair.
   * @return Pool address.
   */
  function getPool(address tok, address midTok) external view returns (address) {
    return tokenUniPool[tok][midTok];
  }

  // the purpose of the function is to encode the pool data that follows the structure declared in IAFi.sol
  function swapData(
    ISwapRouter.ExactInputSingleParams memory swapData
  ) internal pure returns (bytes memory) {
    return (abi.encode(swapData));
  }

  function swapDataMultiHop(
    ISwapRouter.ExactInputParams memory swapData
  ) internal pure returns (bytes memory) {
    return (abi.encode(swapData));
  }

  function uniswapV3Oracle(
    address afiContract,
    address _tokenIn,
    address _tokenOut,
    uint _amountIn,
    uint _maxTime,
    address middleToken,
    uint256 minimumReturnAmount
  ) external onlySpecificAddress(afiContract) returns (bytes memory swapParams) {
    address poolTok;
    if (_tokenIn == WETH || _tokenOut == WETH) {
      if (_tokenIn == WETH) {
        poolTok = _tokenOut;
      } else {
        poolTok = _tokenIn;
      }
      ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
        .ExactInputSingleParams({
          tokenIn: _tokenIn,
          tokenOut: _tokenOut,
          // pool fee
          fee: IUniswapV3Pool(tokenUniPool[poolTok][WETH]).fee(),
          recipient: afiContract,
          deadline: _maxTime,
          amountIn: _amountIn,
          amountOutMinimum: minimumReturnAmount,
          // NOTE: In production, this value can be used to set the limit
          // for the price the swap will push the pool to,
          // which can help protect against price impact
          sqrtPriceLimitX96: 0
        });
      swapParams = swapData(params);
    } else if (_tokenIn == middleToken || _tokenOut == middleToken) {
      if (_tokenIn == middleToken) {
        poolTok = _tokenOut;
      } else {
        poolTok = _tokenIn;
      }
      ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
        .ExactInputSingleParams({
          tokenIn: _tokenIn,
          tokenOut: _tokenOut,
          // pool fee
          fee: IUniswapV3Pool(tokenUniPool[poolTok][middleToken]).fee(),
          recipient: afiContract,
          deadline: _maxTime,
          amountIn: _amountIn,
          amountOutMinimum: minimumReturnAmount,
          // NOTE: In production, this value can be used to set the limit
          // for the price the swap will push the pool to,
          // which can help protect against price impact
          sqrtPriceLimitX96: 0
        });
      swapParams = swapData(params);
    } else {
      ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
        path: abi.encodePacked(
          _tokenIn,
          IUniswapV3Pool(tokenUniPool[_tokenIn][middleToken]).fee(),
          middleToken,
          IUniswapV3Pool(tokenUniPool[_tokenOut][middleToken]).fee(),
          _tokenOut
        ),
        recipient: afiContract,
        deadline: _maxTime,
        amountIn: _amountIn,
        amountOutMinimum: minimumReturnAmount
      });
      swapParams = swapDataMultiHop(params);
    }
  }

  function initUniStructure(
    address[] memory inputTokens,
    bytes memory _poolData
  ) external {
    require(
      msg.sender == owner() ||
        msg.sender == IAFiManager(afiManager).rebalanceController() ||
        msg.sender == afiManager,
      "AFP00"
    );
    UniPoolData memory pooldata = abi.decode(_poolData, (UniPoolData));
    uint pLen = pooldata._underlyingUniPoolToken.length;
    uint iLen = pooldata.stablePools.length;

    unchecked {
      for (uint i = 0; i < pLen; i++) {
        updateUniTok(
          pooldata._underlyingTokens[i],
          pooldata._underlyingUniPoolToken[i],
          pooldata._underlyingUniPool[i]
        );
        updateUniTok(
          pooldata._underlyingTokens[i],
          WETH,
          pooldata._underlyingPoolWithWETH[i]
        );
      }
    }
    unchecked {
      for (uint i = 0; i < iLen; i++) {
        for (uint j = 0; j < pLen; j++) {
          updateUniTok(
            inputTokens[i],
            pooldata._underlyingUniPoolToken[j],
            pooldata.stablePools[i]._pools[j]
          );
        }
        updateUniTok(inputTokens[i], WETH, pooldata.stableWethPool[i]);
      }
    }
  }

  function updateUniTok(address tok, address midTok, address uniPool) internal {
    tokenUniPool[tok][midTok] = uniPool;
  }

  function encodePoolData(
    UniPoolData memory pooldata
  ) external pure returns (bytes memory) {
    return (abi.encode(pooldata));
  }

  function setPriceOracle(
    address[] memory iToken,
    address[] memory underlyingToken,
    address[] memory iTokenOracle,
    address[] memory underlyingTokenOracle
  ) external onlyOwner {
    uint256 iTokenLength = iToken.length;
    uint256 underlyingTokenLength = underlyingToken.length;
    uint uLen = underlyingTokenLength > iTokenLength
      ? underlyingTokenLength
      : iTokenLength;
    priceOracles[WETH] = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    for (uint256 i = 0; i < uLen; i++) {
      if (iTokenLength == uLen) {
        if (i < underlyingTokenLength) {
          priceOracles[underlyingToken[i]] = underlyingTokenOracle[i];
        }
        priceOracles[iToken[i]] = iTokenOracle[i];
      } else {
        if (i < iTokenLength) {
          priceOracles[iToken[i]] = iTokenOracle[i];
        }
        priceOracles[underlyingToken[i]] = underlyingTokenOracle[i];
      }
    }
  }

  function getPriceOracle(address tok) external view returns (address) {
    return priceOracles[tok];
  }

  function removeToken(
    address[] memory tokens,
    address token
  ) external pure returns (address[] memory) {
    (, bool isPresent) = ArrayUtils.indexOf(tokens, token);
    if (isPresent) {
      return ArrayUtils.remove(tokens, token);
    }
    return tokens;
  }

  /**
   * @notice updateOracleData Function updates the oracle address of the new underlying token
   * @dev it should be called by the AFiManager contract only.
   * @param _uToken  i.e the new underlying token.
   * @param _oracleAddress i.e the address of the oracle contract.
   */
  function updateOracleData(address _uToken, address _oracleAddress) external {
    require(msg.sender == owner() || msg.sender == afiManager, "AFP01");
    priceOracles[_uToken] = _oracleAddress;
  }
}
