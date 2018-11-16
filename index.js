var http = require('http');
const ElectrumCli = require("electrum-client");

http.createServer(onRequest).listen(3456);

function onRequest(req, res) {
  var x = req.url.split("?param=");
  var param = x[1]
  var y = x[0].split("?call=")
  var call = y[1]
  if (call == undefined) {
    res.write("Error: Call is undefined");
    res.end();
    return;
  }
  var z = y[0].split("?server=")
  var server = z[1]
  if (server == undefined) {
    res.write("Error: Server is undefined");
    res.end();
    return;
  }
  console.log(param)
  console.log(call)
  console.log(server)

  var eclCall = "";
  switch (call) {
    case 'balance':
      eclCall = 'blockchainAddress_getBalance'
      oneparam()
      break;
    case 'history':
      eclCall = 'blockchainAddress_getHistory'
      oneparam()
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

  function oneparam() {
    var main = async () => {
      var ecl = new ElectrumCli(50002, server, "tls"); // tcp or tls
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
        var verString = JSON.stringify(ver)
        res.write(verString)
        res.end()
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
      var ecl = new ElectrumCli(50002, server, "tls"); // tcp or tls
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