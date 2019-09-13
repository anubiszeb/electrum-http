var http = require('http');
const ElectrumCli = require("electrum-client");
const qs = require("qs");
const bitgotx = require('bitgo-utxo-lib');
const axios = require("axios");

let conTypeDefault = "tls";  // tcp or tls
let conPortDefault = 50002;
let coinDefault = 'bitcoin';
const localhost = "http://127.0.0.1";
const listeningPort = 3456;

http.createServer(onRequest).listen(listeningPort);

function onRequest(req, res) {

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', '*');

  let decMyCP = decodeURIComponent(req.url);
  decMyCP = decMyCP.split("/?")[1];
  const parsed = qs.parse(decMyCP);

  let call = parsed.call;
  let param = parsed.param;
  let server = parsed.server;
  const conPort = parsed.port || conPortDefault;
  const conType = parsed.contype || conTypeDefault;
  const coin = parsed.coin || coinDefault;

  // support backwards compatibility
  if (call == undefined || server == undefined) {
    var x = req.url.split("?param=");
    param = x[1]
    var y = x[0].split("?call=")
    call = y[1]
    var z = y[0].split("?server=")
    server = z[1]
  }

  // support mobile mistake where it was ?param
  if (call !== 'height' && call !== undefined && param === undefined) {
    var x = req.url.split("?param=");
    param = x[1]
    var y = x[0].split("&call=")
    call = y[1]
  }

  if (call == undefined) {
    res.write("Error: Call is undefined");
    res.end();
    return;
  }

  if (server == undefined) {
    res.write("Error: Server is undefined");
    res.end();
    return;
  }

  let network = bitgotx.networks.bitcoin;
  if (param) {
    try {
      network = bitgotx.networks[coin];
    } catch (e) {
      console.log(e)
      res.write("Error: Invalid coin network specified");
      res.end();
      return;
    }
  }

  // console.log(param);
  // console.log(call);
  // console.log(server);
  // console.log(conPort);
  // console.log(conType);

  var eclCall = "";
  switch (call) {
    case 'balance':
      eclCall = 'blockchainScripthash_getBalance'
      oneparam()
      break;
    case 'history':
      eclCall = 'blockchainScripthash_getHistory'
      oneparam(true)
      break;
    case 'entirehistory':
      eclCall = 'blockchainScripthash_getHistory'
      oneparam(false)
      break;
    case 'transaction':
      eclCall = 'blockchainTransaction_get'
      oneparam()
      break;
    case 'transactionnonverbose':
      eclCall = 'blockchainTransaction_get_nonverbose'
      oneparam()
      break;
    case 'transactionverbose':
      eclCall = 'blockchainTransaction_get_verbose'
      oneparam()
      break;
    case 'utxo':
      eclCall = 'blockchainScripthash_listunspent'
      oneparam()
      break;
    case 'broadcast':
      eclCall = 'blockchainTransaction_broadcast'
      oneparam()
      break;
    case 'height':
      eclCall = 'blockchainHeaders_subscribe'
      zeroparam()
      break;
    case 'header':
      eclCall = 'blockchainBlock_getHeader'
      oneparam()
      break;
    case 'nicehistory':
      nicehistory(30)
      break;
    case 'niceentirehistory':
      nicehistory(30000)
      break;
    case 'niceutxo':
      niceutxosimple()
      break;
  }

  function oneparam(limitHistory) {
    var main = async () => {
      var ecl = new ElectrumCli(conPort, server, conType);
      await ecl.connect()
        .catch(function (error) {
          console.log(error)
          res.write(JSON.stringify(error))
          res.end()
          return;
        }); // connect(promise)
      try {
        if (call === 'balance' || call === 'history' || call === 'entirehistory' || call === 'utxo') {
          const paramBuffer = bitgotx.address.toOutputScript(
            param,
            network,
          );
          const scriptHash = bitgotx.crypto.sha256(paramBuffer).reverse().toString("hex");
          console.log(scriptHash);
          param = scriptHash;
          console.log(bitgotx.address.fromOutputScript(paramBuffer, network))
        }
        var ver = await ecl[eclCall](
          param
        ); // json-rpc(promise)
        // console.log(ver)
        if (eclCall === "blockchainScripthash_listunspent") {
          const slicedArray = ver.slice(0, 600);
          const verString = JSON.stringify(slicedArray)
          res.write(verString)
          res.end()
        } else if (eclCall === "blockchainScripthash_getHistory" && limitHistory) {
          if (ver.length > 200) {
            const length = ver.length
            const slicedArray = ver.slice(length - 100, length);
            const verString = JSON.stringify(slicedArray)
            res.write(verString)
            res.end()
          } else {
            var verString = JSON.stringify(ver)
            res.write(verString)
            res.end()
          }
        } else {
          var verString = JSON.stringify(ver)
          res.write(verString)
          res.end()
        }
      } catch (e) {
        res.write("Error: " + e.message)
        res.end()
      }
      await ecl.close(); // disconnect(promise)
    };
    main()
  }

  function zeroparam() {
    var main = async () => {
      var ecl = new ElectrumCli(conPort, server, conType);
      await ecl.connect()
        .catch(function (error) {
          console.log(error)
          res.write(JSON.stringify(error))
          res.end()
          return;
        }); // connect(promise)
      try {
        var ver = await ecl[eclCall](
        ); // json-rpc(promise)
        // console.log(ver)
        var verString = JSON.stringify(ver)
        res.write(verString)
        res.end()
      } catch (e) {
        console.log(e)
        res.write("Error: " + e.message)
        res.end()
      }
      await ecl.close();
    };
    main()
  }

  function nicehistory(amountoftxs) {
    let address = param;

    const historyUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=history&param=${address}`;
    const initHistoryUrls = [historyUrl];
    const initHistoryPromise = initHistoryUrls.map(l => axios.get(l).then(pres => pres.data));
    Promise.all(initHistoryPromise, { timeout: 30000 })
      .then((response) => {
        // console.log(response);
        const myarray = response[0];
        const currentTimestamp = Math.round(new Date() / 1000);
        const ver = myarray.reverse();
        const limit = Math.min(ver.length, amountoftxs); // maximum of txs to fetch
        const lightTransactions = [];
        if (limit === 0) {
          res.write(JSON.stringify(lightTransactions));
          res.end();
        }

        const txUrls = [];
        for (let i = 0; i < limit; i += 1) {
          const transactionUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=transactionverbose&param=${ver[i].tx_hash}`;
          txUrls.push(transactionUrl);
        }
        const txsPromise = txUrls.map(l => axios.get(l).then(pres => pres.data));
        Promise.all(txsPromise, { timeout: 30000 })
          .then((responseB) => {
            for (let j = 0; j < limit; j += 1) {
              const txHeight = ver[j].height;
              const rawtx = responseB[j].hex;
              const tx = bitgotx.Transaction.fromHex(rawtx);
              const result = {
                txid: responseB[j].txid,
                version: responseB[j].version,
                locktime: responseB[j].locktime,
                vin: [],
                vout: [],
                time: responseB[j].time || currentTimestamp,
                confirmations: responseB[j].confirmations || 0,
                valueInSat: 0,
                valueOutSat: 0,
                fees: 0,
                height: txHeight,
              };
              // console.log(tx)
              // console.log(result);
              const insFetching = new Promise((resolve, reject) => {
                tx.ins.forEach((input, index, array) => {
                  const myvin = {
                    txid: !input.hash.reverse
                      ? input.hash
                      : input.hash.reverse().toString("hex"),
                    n: input.index,
                    script: bitgotx.script.toASM(input.script),
                    sequence: input.sequence,
                    scriptSig: {
                      hex: input.script.toString("hex"),
                      asm: bitgotx.script.toASM(input.script),
                    },
                    addr: "",
                    value: 0,
                    valueSat: 0,
                    satoshis: 0,
                  };
                  if (!myvin.txid.includes("00000000000000000000000000000")) {
                    const inputUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=transactionnonverbose&param=${myvin.txid}`;
                    // console.log(myvin.txid);
                    axios.get(inputUrl, { timeout: 30000 })
                      .then((responseInput) => {
                        const inputRes = responseInput.data;
                        // console.log(inputRes)
                        const vintx = bitgotx.Transaction.fromHex(inputRes);
                        const vinOutTx = vintx.outs[myvin.n];
                        myvin.valueSat = vinOutTx.value;
                        myvin.satoshis = vinOutTx.value;
                        myvin.value = (1e-8 * vinOutTx.value);
                        result.valueInSat += vinOutTx.value;
                        result.fees += vinOutTx.value;
                        const type = bitgotx.script.classifyOutput(vinOutTx.script);
                        let pubKeyBuffer;
                        switch (type) {
                          case "pubkeyhash":
                            myvin.addr = bitgotx.address.fromOutputScript(
                              vinOutTx.script,
                              network,
                            );
                            break;
                          case "pubkey":
                            pubKeyBuffer = Buffer.from(
                              myvin.scriptPubKey.asm.split(" ")[0],
                              "hex",
                            );
                            myvin.addr = bitgotx.ECPair.fromPublicKeyBuffer(
                              pubKeyBuffer,
                              network,
                            ).getAddress();
                            break;
                          case "scripthash":
                            myvin.addr = bitgotx.address.fromOutputScript(
                              vinOutTx.script,
                              network,
                            );
                            break;
                          default:
                            /* Do nothing */
                            break;
                        }
                        result.vin.push(myvin);
                        if (index === array.length - 1) resolve();
                      })
                      .catch((e) => {
                        console.log(e)
                        res.write("Error: " + e.message)
                        res.end()
                      });
                  } else if (index === array.length - 1) {
                    setTimeout(() => {
                      resolve();
                    }, 888)
                  }
                });
              });

              insFetching.then(() => {
                responseB[j].vout.forEach((vout) => {
                  vout.satoshi = vout.value * 1e8;
                  vout.valueSat = vout.value * 1e8;
                  result.valueOutSat += (vout.value * 1e8);
                  result.fees -= (vout.value * 1e8);
                  result.vout.push(vout)
                })
                lightTransactions.push(result);
                if (lightTransactions.length === limit) {
                  res.write(JSON.stringify(lightTransactions));
                  res.end();
                }
              });
            }
          })
          .catch((e) => {
            console.log(e);
            res.write("Error: " + e.message);
            res.end();
          });
      })
      .catch((e) => {
        console.log(e);
        res.write("Error: " + e.message);
        res.end();
      });
  }

  function niceutxo() {
    let address = param;

    const utxoUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=utxo&param=${address}`;
    axios.get(utxoUrl, { timeout: 30000 })
      .then((response) => {
        const utxos = response.data;
        const txUrls = [];
        const niceUtxos = [];
        for (let i = 0; i < utxos.length; i += 1) {
          if (utxos[i].height !== 0) { // if === 0, continue
            // console.log("abc")
            // get scriptPubKey
            const txUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=transactionnonverbose&param=${utxos[i].tx_hash}`;
            txUrls.push(txUrl);
          }
        }
        const promiseArr = txUrls.map(l => axios.get(l).then(pres => pres.data));
        Promise.all(promiseArr)
          .then((pres) => {
            // console.log(pres);
            for (let j = 0; j < pres.length; j += 1) {
              const rawtx = pres[j];
              const tx = bitgotx.Transaction.fromHex(rawtx);
              niceUtxos.push({
                txid: utxos[j].tx_hash,
                vout: utxos[j].tx_pos,
                scriptPubKey: tx.outs[utxos[j].tx_pos].script.toString("hex"),
                satoshis: utxos[j].value,
                height: utxos[j].height,
              });
            }
            res.write(JSON.stringify(niceUtxos));
            res.end();
          })
          .catch((e) => {
            console.log(e);
            res.write("Error: " + e.message)
            res.end();
          });
      })
      .catch((e) => {
        console.log(e);
        res.write("Error: " + e.message)
        res.end();
      });
  }

  function niceutxosimple() {
    let address = param;
    const scriptPubKey = bitgotx.address.toOutputScript(
      address,
      network,
    ).toString("hex");
    console.log(scriptPubKey);
    const utxoUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=utxo&param=${address}`;
    axios.get(utxoUrl, { timeout: 30000 })
      .then((response) => {
        const utxos = response.data;
        const niceUtxos = [];
        for (let i = 0; i < utxos.length; i += 1) {
          if (utxos[i].height !== 0) { // if === 0, continue
            niceUtxos.push({
              txid: utxos[i].tx_hash,
              vout: utxos[i].tx_pos,
              scriptPubKey,
              satoshis: utxos[i].value,
              height: utxos[i].height,
            });
          }
        }
        res.write(JSON.stringify(niceUtxos));
        res.end();
      })
      .catch((e) => {
        console.log(e);
        res.write("Error: " + e.message)
        res.end();
      });
  }
}

process.on('uncaughtException', function (exception) {
  console.log(exception)
});