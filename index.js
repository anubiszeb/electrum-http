var http = require('http');
const ElectrumCli = require("electrum-client");
const qs = require("qs");

let conTypeDefault = "tls";  // tcp or tls
let conPortDefault = 50002;

http.createServer(onRequest).listen(3456);

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

  // support backwards compatibility
  if (call == undefined || server == undefined) {
    var x = req.url.split("?param=");
    param = x[1]
    var y = x[0].split("?call=")
    call = y[1]
    var z = y[0].split("?server=")
    server = z[1]
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

}

process.on('uncaughtException', function (exception) {
  console.log(exception)
});