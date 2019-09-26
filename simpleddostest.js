const axios = require("axios");
let i = 0;

while (i < 5) {
  axios.get("http://localhost:3456/?server=proxy.sin.zelcore.io&port=50002&contype=tls&coin=sinovate&call=niceutxo&param=SXoqyAiZ6gQjafKmSnb2pmfwg7qLC8r4Sf")
  .then(response => {
    console.log(response.data);
  })
  .catch(error => {
    console.log(error)
  })
  i++
}