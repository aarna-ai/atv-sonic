// swapModule.js
const axios = require('axios'); // Make sure to install axios using npm
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const swapTokens = async (tokenIn, tokenOut, amountIn, from, origin) => {

    await sleep(1000);

    let swapData;
    console.log("_______________________________________________");
    const url = "https://api.1inch.dev/swap/v6.0/1/swap";
    const config = {
        headers: {
            "Authorization": "Bearer ZTBzxUkHaRg6SqbbejNVVcpTphkh8c8u"
        },
        params: {
            "src": tokenIn,
            "dst": tokenOut,
            "amount": amountIn,
            "from": from,
            "origin": origin,
            "slippage": "1",
            // "protocols": "UNISWAP_V3",
            "allowPartialFill" : "false",
            "disableEstimate": "true",
            "compatibility": "true"
        },
        paramsSerializer: {
            indexes: null
        }
    };

    try {
        const response = await axios.get(url, config);
        // console.log(response.data.tx.data);
        swapData = response.data.tx.data;
    } catch (error) {
        console.error(error);
    }

    return swapData;
};


module.exports = swapTokens;
