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

  console.log(param);
  console.log(call);
  console.log(server);
  console.log(conPort);
  console.log(conType);

  var eclCall = "";
  switch (call) {
    case 'balance':
      eclCall = 'blockchainAddress_getBalance'
      oneparam()
      break;
    case 'history':
      eclCall = 'blockchainAddress_getHistory'
      oneparam(true)
      break;
    case 'entirehistory':
      eclCall = 'blockchainAddress_getHistory'
      oneparam(false)
      break;
    case 'transaction':
      eclCall = 'blockchainTransaction_get'
      oneparam()
      break;
    case 'utxo':
      eclCall = 'blockchainAddress_listunspent'
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
      niceutxo()
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
        var ver = await ecl[eclCall](
          param
        ); // json-rpc(promise)
        //console.log(ver)
        if (eclCall === "blockchainAddress_listunspent") {
          const slicedArray = ver.slice(0, 600);
          const verString = JSON.stringify(slicedArray)
          res.write(verString)
          res.end()
        } else if (eclCall === "blockchainAddress_getHistory" && limitHistory) {
          if (ver.length > 200) {
            const lenght = ver.length
            const slicedArray = ver.slice(lenght - 100, lenght);
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
        res.write(JSON.stringify(e))
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
        //console.log(ver)
        var verString = JSON.stringify(ver)
        res.write(verString)
        res.end()
      } catch (e) {
        console.log(e)
        res.write(JSON.stringify(e))
        res.end()
      }
      await ecl.close();
    };
    main()
  }

  function nicehistory(amountoftxs) {
    const network = bitgotx.networks[coin];
    const constructionType = bitgotx;
    let address = param;

    const historyUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=history&param=${address}`;
    const heightUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=height`;
    const initHistoryUrls = [historyUrl, heightUrl];
    const initHistoryPromise = initHistoryUrls.map(l => axios.get(l).then(pres => pres.data));
    Promise.all(initHistoryPromise, { timeout: 30000 })
      .then((response) => {
        console.log(response);
        const myarray = response[0];
        const currentHeight = response[1].block_height;
        const currentTimestamp = response[1].timestamp;
        const ver = myarray.reverse();
        const limit = Math.min(ver.length, amountoftxs); // maximum of txs to fetch
        const lightTransactions = [];
        if (limit === 0) {
          res.write(JSON.stringify(lightTransactions));
          res.end();
        }

        const txUrls = [];
        for (let i = 0; i < limit; i += 1) {
          const transactionUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=transaction&param=${ver[i].tx_hash}`;
          txUrls.push(transactionUrl);
        }
        const txsPromise = txUrls.map(l => axios.get(l).then(pres => pres.data));
        Promise.all(txsPromise, { timeout: 30000 })
          .then((responseB) => {
            for (let j = 0; j < limit; j += 1) {
              const txHeight = ver[j].height;
              const rawtx = responseB[j];
              const tx = constructionType.Transaction.fromHex(rawtx);
              const result = {
                txid: ver[j].tx_hash,
                version: tx.version,
                locktime: tx.locktime,
                vin: [],
                vout: [],
                time: 0,
                confirmations: 0,
                valueInSat: 0,
                valueOutSat: 0,
                fees: 0,
                height: txHeight,
              };
              // console.log(tx)
              // console.log(result);
              tx.ins.forEach((input) => {
                const myvin = {
                  txid: !input.hash.reverse
                    ? input.hash
                    : input.hash.reverse().toString("hex"),
                  n: input.index, // input.index
                  script: constructionType.script.toASM(input.script),
                  sequence: input.sequence,
                  scriptSig: {
                    hex: input.script.toString("hex"),
                    asm: constructionType.script.toASM(input.script),
                  },
                  addr: "",
                  value: 0,
                  valueSat: 0,
                  satoshis: 0,
                };
                if (!myvin.txid.includes("00000000000000000000000000000")) {
                  const inputUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=transaction&param=${myvin.txid}`;
                  console.log(myvin.txid);
                  axios.get(inputUrl, { timeout: 30000 })
                    .then((responseInput) => {
                      const inputRes = responseInput.data;
                      console.log(inputRes)
                      const vintx = constructionType.Transaction.fromHex(inputRes);
                      const vinOutTx = vintx.outs[myvin.n];
                      myvin.valueSat = vinOutTx.value;
                      myvin.satoshis = vinOutTx.value;
                      myvin.value = (1e-8 * vinOutTx.value);
                      result.valueInSat += vinOutTx.value;
                      result.fees += vinOutTx.value;
                      const type = constructionType.script.classifyOutput(vinOutTx.script);
                      let pubKeyBuffer;
                      switch (type) {
                        case "pubkeyhash":
                          myvin.addr = constructionType.address.fromOutputScript(
                            vinOutTx.script,
                            network,
                          );
                          break;
                        case "pubkey":
                          pubKeyBuffer = Buffer.from(
                            myvin.scriptPubKey.asm.split(" ")[0],
                            "hex",
                          );
                          myvin.addr = constructionType.ECPair.fromPublicKeyBuffer(
                            pubKeyBuffer,
                            network,
                          ).getAddress();
                          break;
                        case "scripthash":
                          myvin.addr = constructionType.address.fromOutputScript(
                            vinOutTx.script,
                            network,
                          );
                          break;
                        default:
                          /* Do nothing */
                          break;
                      }
                      result.vin.push(myvin);
                    })
                    .catch((e) => {
                      console.log(e)
                      res.write(JSON.stringify(e))
                      res.end()
                    });
                }
              });
              tx.outs.forEach((out, n) => {
                const myvout = {
                  satoshi: out.value,
                  valueSat: out.value,
                  value: (1e-8 * out.value),
                  n,
                  scriptPubKey: {
                    asm: constructionType.script.toASM(out.script),
                    hex: out.script.toString("hex"),
                    type: constructionType.script.classifyOutput(out.script),
                    addresses: [],
                  },
                };
                result.valueOutSat += out.value;
                result.fees -= out.value;
                let pubKeyBuffer;
                switch (myvout.scriptPubKey.type) {
                  case "pubkeyhash":
                    myvout.scriptPubKey.addresses.push(
                      constructionType.address.fromOutputScript(out.script, network),
                    );
                    break;
                  case "pubkey":
                    pubKeyBuffer = Buffer.from(
                      myvout.scriptPubKey.asm.split(" ")[0],
                      "hex",
                    );
                    myvout.scriptPubKey.addresses.push(
                      constructionType.ECPair.fromPublicKeyBuffer(
                        pubKeyBuffer,
                        network,
                      ).getAddress(),
                    );
                    break;
                  case "scripthash":
                    myvout.scriptPubKey.addresses.push(
                      constructionType.address.fromOutputScript(out.script, network),
                    );
                    break;
                  default:
                    /* Do nothing */
                    break;
                }
                result.vout.push(myvout);
              });

              if (txHeight === 0) {
                result.confirmations = 0;
                result.time = currentTimestamp
              } else {
                result.confirmations = currentHeight - txHeight + 1;
              }

              lightTransactions.push(result);
            }
            const headerUrls = [];
            for (let i = 0; i < limit; i += 1) {
              const myTxHeight = lightTransactions[i].height === 0 ? currentHeight : lightTransactions[i].height;
              const headerUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=header&param=${myTxHeight}`;
              headerUrls.push(headerUrl);
            }
            const promiseArr = txUrls.map(l => axios.get(l).then(pres => pres.data));
            Promise.all(promiseArr, { timeout: 30000 })
              .then((responseHeaders) => {
                for (let k = 0; k < limit; k += 1) {
                  const header = responseHeaders[k]; // json-rpc(promise)
                  lightTransactions[k].time = header.timestamp
                }
                console.log(lightTransactions);
                res.write(JSON.stringify(lightTransactions));
                res.end();
              })
              .catch((e) => {
                console.log(e);
                res.write(JSON.stringify(e));
                res.end();
              });
          })
          .catch((e) => {
            console.log(e);
            res.write(JSON.stringify(e));
            res.end();
          });
      })
      .catch((e) => {
        console.log(e);
        res.write(JSON.stringify(e));
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
            const txUrl = `${localhost}:${listeningPort}/?server=${server}&port=${conPort}&contype=${conType}&coin=${coin}&call=transaction&param=${utxos[i].tx_hash}`;
            txUrls.push(txUrl);
          }
        }
        const promiseArr = txUrls.map(l => axios.get(l).then(pres => pres.data));
        Promise.all(promiseArr)
          .then((pres) => {
            console.log(pres);
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
            res.write(JSON.stringify(e));
            res.end();
          });
      })
      .catch((e) => {
        console.log(e);
        res.write(JSON.stringify(e));
        res.end();
      });
  }
}

process.on('uncaughtException', function (exception) {
  console.log(exception)
});