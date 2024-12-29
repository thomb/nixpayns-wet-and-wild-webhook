require('dotenv').config();
const luaDebugTable = require('./luaDebugTableToJson');
const path = require('path');
const fs = require('fs');
const createClient = require('redis').createClient;
const childProcess = require("child_process");


const subscriber = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "0"),
  },
});


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


subscriber.on("error", (err) => console.log("Redis subscriber Error", err));

(async () => {



  await subscriber.connect();

  let isFightInProgress = false;
  await subscriber.subscribe('mugen', async (messageString) => {
    try {
      const message = JSON.parse(messageString);
      switch (message.messageType) {
        case 'fight':
          if (!message?.payload?.fights) {
            throw new Error('Payload contained no fights');
          };

          if (isFightInProgress) {
            console.warn(`A fight is currently in progress, this fight will be discarded: ${JSON.stringify(message)}`)
          }
          isFightInProgress = true;
          await processFight(message.payload.fights);

          isFightInProgress = false;
          break;
        default: 
          console.log(`${message.messageType} is not supported`)
      }

    } catch (err) {
      console.error(err)
    }
  });
})();


const processFight = async (fights) => {
  for await (const fight of fights) {
    await startFight(fight);
  }
}


const startFight = async (fight) => {
  const {
    id,
    rounds,
    stage,
    teamOne,
    teamTwo,
  } = fight;
  console.log('fight',fight);

  if (!id) {
    console.warn('Fight has no ID, results will not be tracked');
  }
  const args = [];
  const players = [];
  let availableFighters = [...teamOne.fighters, ...teamTwo.fighters];
  let playerIndex = 1;
  let fighterIndex = 0;

  if (teamOne?.fighters?.length && teamTwo?.fighters?.length) {
    while (players.length < availableFighters.length) {
      // prettier-ignore
      args.push(`-p${playerIndex} "${teamOne.fighters[fighterIndex].name}"`);
      args.push(`-p${playerIndex}.ai 1`);
      players.push(1);
      playerIndex++;
      // prettier-ignore
      args.push(`-p${playerIndex} "${teamTwo.fighters[fighterIndex].name}"`);
      args.push(`-p${playerIndex}.ai 1`);
      players.push(1);
      playerIndex++;
      fighterIndex++;
    }
  }
  args.push(`-rounds ${rounds}`);
  if (stage !== undefined) {
    args.push(`-s "${stage}"`);
  }

  const logLocation = 'results.log';
  if (process.env.DISABLE_LOGGING === "0") {
    args.push(`-log ${logLocation}`)
  }
  if (process.env.NOSOUND === "1") {
    args.push(`-nosound`);
  }

  // Set the fight to inprogress on the database
  const inProgressMessage = {
    messageType: "inProgress",
    payload: {
      fight,
    },
  };

  await fetch(`${process.env.REMOTE_HOST}`, {
    method: "POST",
    body: JSON.stringify(inProgressMessage),
  });

  const delay = parseInt(process.env.FIGHT_START_DELAY_MS || '0');
  if (delay)  {
    // TODO: Do stuff like publish a notice to twitch that betting is open etc etc
    await sleep(delay);
  }



   childProcess.execFileSync(process.env.MUGEN, args, {
    cwd: process.env.MUGEN_PATH,
    shell: true,
    windowsVerbatimArguments: true,
  });

  const payload = {
      fight,
      resultData: {
        winningteam: 0,
        rawResults: []
      }
  }
  if (process.env.DISABLE_LOGGING === "0") {
    // Parse the fight results
    const results = fs.readFileSync(path.join(process.env.MUGEN_PATH, logLocation), "utf8");
    const resultData = parseResults(results);
    payload.resultData = resultData;
  } else {
    console.log('Logging disabled, will be tracked as a draw');
  }
  const resultsMessage = {
    messageType: "results",
    payload,
  };

  console.log('resultsMessage',resultsMessage);

  await fetch(`${process.env.REMOTE_HOST}`, {
    method: "POST",
    body: JSON.stringify(resultsMessage),
  });
}


const parseResults = (resultsData) => {
  const results  = luaDebugTable.luaDebugTableToJson(resultsData);
  const winningTeam = results.winTeam;

  return {
    winningTeam,
    rawResults: results
  };
}
