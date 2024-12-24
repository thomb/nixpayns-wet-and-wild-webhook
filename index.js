require('dotenv').config();

const createClient = require('redis').createClient;
const childProcess = require("child_process");


(async () => {

  const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "0"),
    },
  });

  client.on("error", (err) => console.log("Redis Client Error", err));
  await client.connect();


  await client.subscribe('mugen', async (messageString) => {
    try {
      const message = JSON.parse(messageString);
      switch (message.messageType) {
        case 'fight':
          if (!message?.payload?.fights) {
            throw new Error('Payload contained no fights');
          };

          for await (const fight of message.payload.fights) {
            await startFight(fight);
          }
          break;
        default: 
          console.log(`${message.messageType} is not supported`)
      }

    } catch (err) {
      console.error(err)
    }
  });
})();


const startFight = async (fight) => {
  const {
    teamOne,
    teamTwo,
    rounds,
    id
  } = fight;

  if (!id) {
    console.warn('Fight has no ID, results will not be tracked');
  }
  const players = [];
  let availableFighters = [...teamOne.fighters, ...teamTwo.fighters];
  let playerIndex = 1;
  let fighterIndex = 0;

  if (teamOne?.fighters?.length && teamTwo?.fighters?.length) {
    while (players.length < availableFighters.length) {
      // prettier-ignore
      players.push(`-p${playerIndex} "${teamOne.fighters[fighterIndex].name}"`);
      players.push(`-p${playerIndex}.ai 1`);
      playerIndex++;
      // prettier-ignore
      players.push(`-p${playerIndex} "${teamTwo.fighters[fighterIndex].name}"`);
      players.push(`-p${playerIndex}.ai 1`);
      playerIndex++;
      fighterIndex++;
    }
  }
  players.push(`-rounds ${rounds}`);
  console.log('players',players);

  const result = childProcess.execFileSync(process.env.MUGEN, players, {
    cwd: process.env.MUGEN_PATH,
    windowsVerbatimArguments: true,
  });
  console.log('result',result);
}
