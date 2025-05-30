// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IAFi.
 * @notice Interface of the AToken.
 */
interface IAFi {
    function depositUserNav(address user) external returns(uint256);
    function stakeShares(address user, uint256 amount, bool lock) external;
}

contract AFiTimeLockMock {
    IERC20 public rewardToken;
    uint256 public cap;   // The maximum total rewards to distribute
    uint256 public totalRewardsDistributed;
    uint256 public numLockDates;
    uint256 public numLockPeriods;
    uint256 public baseRate; // 100 for 1% base rate

    uint256 public constant MAX_BASE_RATE = 1000; // Maximum base rate can be set at 10%

    mapping (address => bool) public isAFiToken;  // The token being staked
    mapping (address => uint256) public totalStaked;
    mapping (uint256 => uint256) public lockDates; // First lockDate will be the launch date
    mapping (uint256 => uint256) public lockDateFactor; // 1000 for 1% and first factor will be 0
    mapping (uint256 => uint256) public lockPeriods;
    mapping (uint256 => uint256) public lockPeriodFactor; // 1000 for 1%
    mapping (address => mapping (uint256 => Stake)) public stakingDetails;
    mapping (address => uint256) public numStakes;
    mapping (address => Freeze) public frozen;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 durationIndex;
        address token;
        uint256 lockdate;
        uint256 lockdateFactor;
        uint256 rewardAmount;
        bool claimed;
    }

    struct Freeze {
        bool isFrozen;
        uint256 freezingDate;
    }

    event CapSet(uint256 _cap);
    event BaseRateSet(uint256 _rate);
    event RewardTokenSet(address indexed _rewardToken);
    event AFiTokenAdded(address indexed _afiToken);
    event AFiTokenRemoved(address indexed _afiToken);
    event AFiTokenFrozen(address indexed _afiToken, uint256 _freezingDate);
    event Staked(
        address indexed user,
        address indexed _afiToken,
        uint256 _amount,
        uint256 _lockPeriod,
        uint256 _userStakeCounter
    );
    event Unstaked(
        address indexed user,
        uint256 _reward,
        uint256 _userStakeCounter
    );
    event UnclaimedRewardsWithdrawn(
        address _owner,
        uint256 _unclaimedRewards
    );

    constructor (address token) {
        require(token != address(0), "TimeLock: Please enter a valid address");
        rewardToken = IERC20(token);
        emit RewardTokenSet(token);
    }

    function setCap(uint256 _cap) external {
        require(_cap > cap, "TimeLock: Cap must be greater than current cap");
        uint256 trnasferFromAmount;
        if (cap > 0) trnasferFromAmount = _cap - cap;
        cap = _cap;
        if (trnasferFromAmount == 0) trnasferFromAmount = _cap;
        emit CapSet(cap);
        rewardToken.transferFrom(msg.sender, address(this), trnasferFromAmount);
    }

    function setBaseRate(uint256 _rate) external {
        require(_rate > 0, "TimeLock: base rate must be greater than 0");
        require(_rate <= MAX_BASE_RATE, "TimeLock: base rate cannot exceed 10%");
        require(baseRate == 0, "TimeLock: base rate initialized already");
        baseRate = _rate;
        emit BaseRateSet(_rate);
    }

    function addAFiToken(address token) external {

        require(token != address(0), "TimeLock: Please enter a valid address");
        require(!isAFiToken[token], "TimeLock: Already added");

        isAFiToken[token] = true;

        emit AFiTokenAdded(token);
    }

    function removeAFiToken(address token) external  {

        require(token != address(0), "TimeLock: Please enter a valid address");
        require(isAFiToken[token], "TimeLock: Not added yet");

        delete isAFiToken[token];

        emit AFiTokenRemoved(token);
    }

    function freezeRewardsForAFiToken(address token) external  {

        require(token != address(0), "TimeLock: Please enter a valid address");
        require(isAFiToken[token], "TimeLock: Not an AFi token");
        require(!frozen[token].isFrozen, "TimeLock: Token already frozen");

        frozen[token].isFrozen = true;
        frozen[token].freezingDate = block.timestamp;

        emit AFiTokenFrozen(token, frozen[token].freezingDate);

    }

    function stake(uint256 amount, address token, uint256 lockPeriodIndex) external {

        // require(
        //     block.timestamp >= lockDates[0] && block.timestamp <= lockDates[numLockDates - 1],
        //     "TimeLock: Not the time to stake"
        // );
        require(isAFiToken[token], "TimeLock: This token is not stakable");
        require(amount > 0, "TimeLock: Amount must be greater than 0");
        require(!frozen[token].isFrozen, "TimeLock: Staking is frozen for this token");

        uint256 i;

        uint256 rewardAmount = 100;

        totalRewardsDistributed += rewardAmount;

        require(totalRewardsDistributed <= cap, "TimeLock: Reward cap reached");

        stakingDetails[msg.sender][numStakes[msg.sender]] = Stake(
            amount,
            block.timestamp,
            lockPeriodIndex,
            token,
            lockDates[i],
            lockDateFactor[i],
            rewardAmount,
            false
        );

        totalStaked[token] += amount;

        numStakes[msg.sender]++;

        IAFi(token).stakeShares(msg.sender, amount, true);

        emit Staked(
            msg.sender,
            token,
            amount,
            lockPeriods[lockPeriodIndex],
            numStakes[msg.sender]
        );

    }

    function unstake(uint256 stakeIndex) external {

        require(numStakes[msg.sender] > stakeIndex, "TimeLock: Invalid index");

        Stake storage userStake = stakingDetails[msg.sender][stakeIndex];

        require(!userStake.claimed, "TimeLock: Already claimed");

        uint256 j;
        uint256 reward;
        uint256 stakingDuration;

        if (frozen[userStake.token].isFrozen) {
            stakingDuration = frozen[userStake.token].freezingDate - userStake.startTime;
        } else {
            stakingDuration = block.timestamp - userStake.startTime;
        }

        uint256 durationIndex = userStake.durationIndex;

        if (stakingDuration >= lockPeriods[0] && stakingDuration < lockPeriods[durationIndex]) {

            for (j = 0; j < durationIndex; j++) {

                if (stakingDuration >= lockPeriods[j] && stakingDuration < lockPeriods[j + 1]) {
                    durationIndex = j;

                    break;
                }

            }

            reward = (
                (userStake.rewardAmount * lockPeriodFactor[durationIndex] * lockPeriods[durationIndex]) / 
                (lockPeriodFactor[userStake.durationIndex] * lockPeriods[userStake.durationIndex])
            );

            totalRewardsDistributed -= (userStake.rewardAmount - reward);

            userStake.rewardAmount = reward;

        } else if (stakingDuration < lockPeriods[0]) {

            totalRewardsDistributed -= userStake.rewardAmount;

            reward = 0;

        } else {

            reward = userStake.rewardAmount;

        }

        totalStaked[userStake.token] -= userStake.amount;
        userStake.claimed = true;

        IAFi(userStake.token).stakeShares(msg.sender, userStake.amount, false);

        emit Unstaked(
            msg.sender,
            reward,
            stakeIndex
        );

        if (reward > 0) rewardToken.transfer(msg.sender, reward);

    }

    function setLockDateDetails(
        uint256[] calldata _lockDates,
        uint256[] calldata _lockDateFactors
    ) external {

        require(_lockDates.length == (_lockDateFactors.length + 1), "TimeLock: Array lengths not appropriate");
        require(numLockDates == 0, "TimeLock: Lock dates initialized already");

        for(uint i = 0; i < _lockDates.length; i++) {
            lockDates[i] = _lockDates[i];
            if (i < _lockDateFactors.length) {
                lockDateFactor[i] = _lockDateFactors[i];
            }
        }

        numLockDates = _lockDates.length;

    }

    function setLockPeriodDetails(
        uint256[] calldata _lockPeriods,
        uint256[] calldata _lockPeriodFactors
    ) external    {

        require(_lockPeriods.length == _lockPeriodFactors.length, "TimeLock: Array lengths should be equal");
        require(numLockPeriods == 0, "TimeLock: Lock periods initialized already");

        for(uint i = 0; i < _lockPeriods.length; i++) {
            lockPeriods[i] = _lockPeriods[i];
            lockPeriodFactor[i] = _lockPeriodFactors[i];
        }

        numLockPeriods = _lockPeriods.length;

    }

}